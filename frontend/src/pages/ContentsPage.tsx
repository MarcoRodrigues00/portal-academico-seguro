import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

// ── Types ─────────────────────────────────────────────────────────

type ContentType = 'PDF' | 'SLIDE' | 'VIDEO' | 'LINK'

interface Subject {
  id: string
  code: string
  name: string
  semester: { name: string; isActive: boolean }
}

interface Content {
  id: string
  title: string
  type: ContentType
  filePath: string | null
  url: string | null
  createdAt: string
  postedBy: { name: string } | null
}

interface SubjectContents {
  subject: Subject
  contents: Content[]
  loading: boolean
  error: boolean
}

interface ContentFormState {
  title: string
  type: ContentType
  url: string
  submitting: boolean
  success: string | null
  error: string | null
}

// ── Config ────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ContentType, { label: string; color: string; dim: string }> = {
  PDF:   { label: 'PDF',   color: 'text-red-400',   dim: 'border-red-400/25   bg-red-400/8'   },
  SLIDE: { label: 'SLIDE', color: 'text-[#00c8ff]', dim: 'border-[#00c8ff]/25 bg-[#00c8ff]/6' },
  VIDEO: { label: 'VÍDEO', color: 'text-[#f0c040]', dim: 'border-[#f0c040]/25 bg-[#f0c040]/6' },
  LINK:  { label: 'LINK',  color: 'text-[#39ff85]', dim: 'border-[#39ff85]/25 bg-[#39ff85]/6' },
}

const ALL_TYPES: ContentType[] = ['LINK', 'PDF', 'SLIDE', 'VIDEO']

// ── Helpers ───────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Component ─────────────────────────────────────────────────────

export default function ContentsPage() {
  const { user } = useAuth()
  const isProfessor = (user?.roles ?? []).some(r => r === 'professor' || r === 'admin')

  const [rows, setRows] = useState<SubjectContents[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)

  // Professor: form state per subject
  const [contentForms, setContentForms] = useState<Record<string, ContentFormState>>({})

  function getForm(sid: string): ContentFormState {
    return contentForms[sid] ?? { title: '', type: 'LINK', url: '', submitting: false, success: null, error: null }
  }

  function patchForm(sid: string, patch: Partial<ContentFormState>) {
    setContentForms(prev => ({ ...prev, [sid]: { ...getForm(sid), ...patch } }))
  }

  async function handleContentSubmit(sid: string, e: React.FormEvent) {
    e.preventDefault()
    const f = getForm(sid)

    if (!f.title.trim()) {
      patchForm(sid, { error: 'O título é obrigatório.' })
      return
    }
    if (!f.url.trim()) {
      patchForm(sid, { error: 'A URL é obrigatória.' })
      return
    }

    patchForm(sid, { submitting: true, error: null, success: null })

    try {
      const { data } = await api.post<{ content: Content }>(`/subjects/${sid}/contents`, {
        title: f.title.trim(),
        type:  f.type,
        url:   f.url.trim(),
      })

      // Prepend novo conteúdo à lista local sem refetch
      const newContent: Content = {
        ...data.content,
        postedBy: user ? { name: user.name } : null,
      }

      setRows(prev =>
        prev.map(r =>
          r.subject.id === sid
            ? { ...r, contents: [newContent, ...r.contents] }
            : r
        )
      )

      patchForm(sid, { title: '', type: 'LINK', url: '', submitting: false, success: 'Material publicado com sucesso.' })
    } catch (err: any) {
      const msg    = err?.response?.data?.error
      const errMsg = typeof msg === 'string' ? msg : 'Erro ao publicar material. Verifique os dados.'
      patchForm(sid, { submitting: false, error: errMsg })
    }
  }

  // Fetch subjects, then contents per subject
  useEffect(() => {
    api.get<{ subjects: Subject[] }>('/subjects/me')
      .then(({ data }) => {
        const initial = data.subjects.map(subject => ({
          subject,
          contents: [],
          loading: true,
          error: false,
        }))
        setRows(initial)
        setLoadingSubjects(false)

        data.subjects.forEach((subject, idx) => {
          api.get<{ contents: Content[] }>(`/subjects/${subject.id}/contents`)
            .then(({ data: d }) => {
              setRows(prev =>
                prev.map((r, i) => i === idx ? { ...r, contents: d.contents, loading: false } : r)
              )
            })
            .catch(() => {
              setRows(prev =>
                prev.map((r, i) => i === idx ? { ...r, loading: false, error: true } : r)
              )
            })
        })
      })
      .catch(() => {
        setSubjectsError('Não foi possível carregar os materiais.')
        setLoadingSubjects(false)
      })
  }, [])

  const activeSemester = rows[0]?.subject.semester.name ?? '—'
  const totalMaterials = rows.reduce((s, r) => s + r.contents.length, 0)

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-8">
        <p className="section-label mb-2">Área acadêmica</p>
        <h1 className="text-2xl font-bold text-[#ccd8e0]">
          Materiais de <span className="neon-text">Apoio</span>
        </h1>
        {!loadingSubjects && !subjectsError && rows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-xs text-[#4a6172]">
                {totalMaterials} material{totalMaterials !== 1 ? 'is' : ''} · {rows.length} disciplina{rows.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-80" />
              <span className="text-xs text-[#4a6172]">Semestre {activeSemester}</span>
            </div>
            {isProfessor && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#273a47]" />
                <span className="text-xs text-[#4a6172]">Publicação disponível por disciplina</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loadingSubjects && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
            <span className="text-xs text-[#4a6172] tracking-widest uppercase animate-pulse">
              Carregando materiais...
            </span>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {!loadingSubjects && subjectsError && (
        <div className="flex items-start gap-3 rounded-md border border-red-400/25 bg-red-400/8 px-4 py-3">
          <span className="text-sm text-red-400">✕</span>
          <p className="text-xs text-red-400/80">{subjectsError}</p>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#192633] bg-[#0f1820]">
            <svg className="h-7 w-7 text-[#273a47]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#273a47]">Nenhum material disponível</p>
            <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-[#192633]">
              {isProfessor
                ? 'Nenhuma disciplina vinculada. Publique materiais após vinculação no sistema acadêmico.'
                : 'Nenhuma disciplina ou material encontrado para este semestre. Os arquivos são disponibilizados pelos professores.'
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Seções por disciplina ─────────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="flex flex-col gap-6">
          {rows.map((row, si) => (
            <div
              key={row.subject.id}
              className="animate-fade-in"
              style={{ animationDelay: `${si * 60}ms` }}
            >
              {/* Subject header */}
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[10px] text-[#39ff85]">{row.subject.code}</span>
                <div className="h-px flex-1 bg-[#192633]" />
                {row.loading ? (
                  <div className="h-2 w-10 rounded bg-[#192633] animate-pulse" />
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-[#273a47]">
                    {row.contents.length} item{row.contents.length !== 1 ? 's' : ''}
                  </span>
                )}
                {isProfessor && <span className="badge badge-blue">Docente</span>}
              </div>

              <p className="mb-3 text-sm font-semibold text-[#ccd8e0]">{row.subject.name}</p>

              {/* Loading */}
              {row.loading && (
                <div className="panel flex items-center gap-2 px-4 py-3">
                  <div className="h-1 w-1 rounded-full bg-[#273a47] animate-pulse" />
                  <span className="text-[10px] text-[#273a47] animate-pulse">Carregando materiais...</span>
                </div>
              )}

              {/* Error */}
              {!row.loading && row.error && (
                <div className="panel px-4 py-3">
                  <span className="text-[10px] text-red-400/60">Falha ao carregar materiais desta disciplina.</span>
                </div>
              )}

              {/* Sem conteúdos */}
              {!row.loading && !row.error && row.contents.length === 0 && (
                <div className="panel px-4 py-3">
                  <span className="text-[10px] text-[#273a47]">Nenhum material disponível ainda.</span>
                </div>
              )}

              {/* Lista de materiais */}
              {!row.loading && !row.error && row.contents.length > 0 && (
                <div className="flex flex-col gap-2">
                  {row.contents.map(content => {
                    const cfg  = TYPE_CONFIG[content.type] ?? TYPE_CONFIG.LINK
                    const href = content.url ?? (content.filePath ? `/files/${content.filePath}` : undefined)
                    return (
                      <div
                        key={content.id}
                        className="panel flex items-center gap-3 px-4 py-3 transition-colors hover:border-[#39ff8530]"
                      >
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-widest ${cfg.color} ${cfg.dim}`}>
                          {cfg.label}
                        </span>

                        <p className="flex-1 text-xs text-[#ccd8e0]">{content.title}</p>

                        <div className="flex shrink-0 items-center gap-3">
                          <div className="hidden sm:flex flex-col items-end gap-0.5">
                            <span className="font-mono text-[9px] text-[#273a47]">
                              {fmtDate(content.createdAt)}
                            </span>
                            {content.postedBy && (
                              <span className="text-[8px] text-[#192633]">
                                por {content.postedBy.name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded border border-[#192633] bg-[#0f1820] px-3 py-1 text-[10px] text-[#4a6172] transition-colors hover:border-[#39ff8440] hover:text-[#39ff85]"
                            >
                              {content.type === 'LINK' ? 'Acessar →' : 'Baixar →'}
                            </a>
                          ) : (
                            <span className="rounded border border-[#192633] bg-[#0f1820] px-3 py-1 text-[10px] text-[#273a47]">
                              Indisponível
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Formulário de publicação (apenas professor) ── */}
              {isProfessor && !row.loading && !row.error && (() => {
                const f = getForm(row.subject.id)
                return (
                  <div className="mt-3 panel-hud p-4">
                    <p className="section-label mb-4">Publicar material</p>
                    <form onSubmit={e => handleContentSubmit(row.subject.id, e)} className="flex flex-col gap-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                            Título
                          </label>
                          <input
                            type="text"
                            value={f.title}
                            onChange={e => patchForm(row.subject.id, { title: e.target.value, success: null })}
                            placeholder="Nome do arquivo ou link…"
                            className="input-cyber text-xs"
                            maxLength={200}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                            Tipo
                          </label>
                          <select
                            value={f.type}
                            onChange={e => patchForm(row.subject.id, { type: e.target.value as ContentType, success: null })}
                            className="input-cyber text-xs"
                          >
                            {ALL_TYPES.map(t => (
                              <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                          URL
                        </label>
                        <input
                          type="url"
                          value={f.url}
                          onChange={e => patchForm(row.subject.id, { url: e.target.value, success: null })}
                          placeholder="https://…"
                          className="input-cyber text-xs"
                        />
                      </div>

                      {f.success && (
                        <div className="flex items-center gap-2 rounded-md border border-[#39ff8430] bg-[#39ff8508] px-3 py-2">
                          <span className="text-[10px] text-[#39ff85]">✓ {f.success}</span>
                        </div>
                      )}
                      {f.error && (
                        <div className="flex items-center gap-2 rounded-md border border-red-400/25 bg-red-400/8 px-3 py-2">
                          <span className="text-[10px] text-red-400">✕ {f.error}</span>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={f.submitting}
                          className="btn-primary py-1.5 px-5 text-xs disabled:opacity-50"
                        >
                          {f.submitting ? 'Publicando…' : 'Publicar material'}
                        </button>
                      </div>
                    </form>
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-md border border-[#192633] bg-[#0b1117] px-4 py-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-70" />
          <span className="text-[10px] text-[#273a47]">
            {isProfessor
              ? 'Materiais publicados ficam disponíveis imediatamente para os alunos matriculados.'
              : 'Materiais disponibilizados pelo professor. Uso exclusivo para fins acadêmicos.'
            }
          </span>
        </div>
      )}

    </Layout>
  )
}
