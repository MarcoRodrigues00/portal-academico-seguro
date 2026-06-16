import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

// ── Interfaces ────────────────────────────────────────────────────

interface Subject {
  id: string
  code: string
  name: string
  semester: { name: string; isActive: boolean }
}

interface Grade {
  id: string
  assessmentName: string
  score: number
  maxScore: number
  recordedAt: string
}

interface SubjectGrades {
  subject: Subject
  grades: Grade[]
  loading: boolean
  error: boolean
}

interface GradeFormState {
  userId: string
  assessmentName: string
  score: string
  maxScore: string
  submitting: boolean
  success: string | null
  error: string | null
}

// ── Helpers ───────────────────────────────────────────────────────

function normalizeGrade(score: number, maxScore: number): number {
  return Math.round((score / maxScore) * 10 * 10) / 10
}

function computeMedia(grades: Grade[]): number | null {
  if (grades.length === 0) return null
  const sum = grades.reduce((acc, g) => acc + (g.score / g.maxScore) * 10, 0)
  return Math.round((sum / grades.length) * 10) / 10
}

function fmtGrade(v: number | null): string {
  return v === null ? '—' : v.toFixed(1)
}

function gradeColor(v: number | null): string {
  if (v === null) return 'text-[#273a47]'
  if (v >= 7.0)   return 'text-[#39ff85]'
  if (v >= 5.0)   return 'text-[#f0c040]'
  return 'text-red-400'
}

function statusOf(media: number | null): { label: string; cls: string } {
  if (media === null) return { label: 'Pendente',     cls: 'badge-blue'   }
  if (media >= 7.0)   return { label: 'Aprovado',     cls: 'badge-green'  }
  if (media >= 5.0)   return { label: 'Recuperação',  cls: 'badge-yellow' }
  return                      { label: 'Reprovado',   cls: 'badge-red'    }
}

// ── Component ─────────────────────────────────────────────────────

export default function GradesPage() {
  const { user } = useAuth()
  const isProfessor = (user?.roles ?? []).some(r => r === 'professor' || r === 'admin')

  const [rows, setRows] = useState<SubjectGrades[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)

  // Professor: form state per subject
  const [gradeForms, setGradeForms] = useState<Record<string, GradeFormState>>({})

  function getForm(sid: string): GradeFormState {
    return gradeForms[sid] ?? {
      userId: '', assessmentName: '', score: '', maxScore: '10',
      submitting: false, success: null, error: null,
    }
  }

  function patchForm(sid: string, patch: Partial<GradeFormState>) {
    setGradeForms(prev => ({ ...prev, [sid]: { ...getForm(sid), ...patch } }))
  }

  async function handleGradeSubmit(sid: string, e: React.FormEvent) {
    e.preventDefault()
    const f = getForm(sid)
    const score    = parseFloat(f.score)
    const maxScore = parseFloat(f.maxScore)

    if (!f.userId.trim() || !f.assessmentName.trim() || isNaN(score) || isNaN(maxScore) || maxScore <= 0) {
      patchForm(sid, { error: 'Preencha todos os campos corretamente.' })
      return
    }

    patchForm(sid, { submitting: true, error: null, success: null })

    try {
      await api.post(`/subjects/${sid}/grades`, {
        userId:         f.userId.trim(),
        assessmentName: f.assessmentName.trim(),
        score,
        maxScore,
      })
      patchForm(sid, {
        userId: '', assessmentName: '', score: '', maxScore: '10',
        submitting: false, success: 'Nota lançada com sucesso.',
      })
    } catch (err: any) {
      const msg    = err?.response?.data?.error
      const errMsg = typeof msg === 'string' ? msg : 'Erro ao lançar nota. Verifique os dados e o UUID do aluno.'
      patchForm(sid, { submitting: false, error: errMsg })
    }
  }

  // Fetch subjects, then grades (student view only)
  useEffect(() => {
    api.get<{ subjects: Subject[] }>('/subjects/me')
      .then(({ data }) => {
        const initial = data.subjects.map(subject => ({
          subject,
          grades: [],
          loading: !isProfessor, // professor não precisa buscar notas
          error: false,
        }))
        setRows(initial)
        setLoadingSubjects(false)

        if (isProfessor) return // professor não busca notas do próprio usuário

        data.subjects.forEach((subject, idx) => {
          api.get<{ grades: Grade[] }>(`/subjects/${subject.id}/grades`)
            .then(({ data: d }) => {
              setRows(prev =>
                prev.map((r, i) => i === idx ? { ...r, grades: d.grades, loading: false } : r)
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
        setSubjectsError('Não foi possível carregar o boletim.')
        setLoadingSubjects(false)
      })
  }, [isProfessor])

  const activeSemester = rows[0]?.subject.semester.name ?? '—'
  const allLoaded = !loadingSubjects && rows.every(r => !r.loading)

  // Métricas — apenas para alunos
  const completed = rows.filter(r => !r.loading && !r.error && r.grades.length > 0)
  const approved  = completed.filter(r => (computeMedia(r.grades) ?? 0) >= 7.0).length
  const atRisk    = completed.filter(r => {
    const m = computeMedia(r.grades)
    return m !== null && m < 7.0
  }).length
  const pending = rows.filter(r => !r.loading && !r.error && r.grades.length === 0).length

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-8">
        <p className="section-label mb-2">Área acadêmica</p>
        <h1 className="text-2xl font-bold text-[#ccd8e0]">
          {isProfessor
            ? <>Lançamento de <span className="neon-text">Notas</span></>
            : <>Boletim <span className="neon-text">Escolar</span></>
          }
        </h1>

        {/* Professor: info de docente */}
        {isProfessor && !loadingSubjects && !subjectsError && rows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-80" />
              <span className="text-xs text-[#4a6172]">
                {rows.length} disciplina{rows.length !== 1 ? 's' : ''} · Semestre {activeSemester}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-xs text-[#4a6172]">Lançamento e correção via upsert</span>
            </div>
          </div>
        )}

        {/* Aluno: resumo do boletim */}
        {!isProfessor && allLoaded && !subjectsError && rows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-xs text-[#4a6172]">
                {approved} aprovada{approved !== 1 ? 's' : ''} · Semestre {activeSemester}
              </span>
            </div>
            {atRisk > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#f0c040]" />
                <span className="text-xs text-[#4a6172]">{atRisk} em atenção</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#273a47]" />
              <span className="text-xs text-[#4a6172]">{pending} aguardando nota</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loadingSubjects && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
            <span className="text-xs text-[#4a6172] tracking-widest uppercase animate-pulse">
              Carregando boletim...
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#273a47]">
              {isProfessor ? 'Nenhuma disciplina encontrada' : 'Boletim sem registros'}
            </p>
            <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-[#192633]">
              {isProfessor
                ? 'Nenhuma disciplina vinculada à sua conta de docente.'
                : 'Nenhuma disciplina ou nota encontrada para o semestre atual. Verifique com a secretaria acadêmica.'
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Alert: disciplinas em risco (apenas aluno) ─────────── */}
      {!isProfessor && allLoaded && atRisk > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-[#f0c040]/25 bg-[#f0c040]/6 px-4 py-3 animate-fade-in">
          <span className="mt-0.5 text-sm text-[#f0c040]">⚠</span>
          <p className="text-xs text-[#f0c040]/80">
            <strong className="font-semibold text-[#f0c040]">Atenção:</strong>{' '}
            Você tem {atRisk === 1 ? '1 disciplina' : `${atRisk} disciplinas`} com média abaixo de 7,0.
            Verifique o calendário de recuperação.
          </p>
        </div>
      )}

      {/* ── Conteúdo por disciplina ───────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="flex flex-col gap-4">
          {rows.map((row, si) => {

            // ── PROFESSOR: painel de lançamento ─────────────────
            if (isProfessor) {
              const f = getForm(row.subject.id)
              return (
                <div
                  key={row.subject.id}
                  className="panel-hud overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${si * 55}ms` }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#192633] bg-[#0b1117] px-5 py-3">
                    <div>
                      <span className="font-mono text-[10px] text-[#39ff85]">{row.subject.code}</span>
                      <p className="mt-0.5 text-xs font-semibold text-[#ccd8e0]">{row.subject.name}</p>
                    </div>
                    <span className="badge badge-blue">Docente</span>
                  </div>

                  {/* Formulário */}
                  <div className="p-5">
                    <p className="section-label mb-4">Lançar nota</p>
                    <form onSubmit={e => handleGradeSubmit(row.subject.id, e)} className="flex flex-col gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                            UUID do aluno
                          </label>
                          <input
                            type="text"
                            value={f.userId}
                            onChange={e => patchForm(row.subject.id, { userId: e.target.value, success: null })}
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            className="input-cyber font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                            Avaliação
                          </label>
                          <input
                            type="text"
                            value={f.assessmentName}
                            onChange={e => patchForm(row.subject.id, { assessmentName: e.target.value, success: null })}
                            placeholder="Prova 1, Trabalho Final…"
                            className="input-cyber text-xs"
                            maxLength={50}
                          />
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                            Nota obtida
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={f.score}
                            onChange={e => patchForm(row.subject.id, { score: e.target.value, success: null })}
                            placeholder="8.5"
                            className="input-cyber font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                            Nota máxima
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={f.maxScore}
                            onChange={e => patchForm(row.subject.id, { maxScore: e.target.value, success: null })}
                            placeholder="10.0"
                            className="input-cyber font-mono text-xs"
                          />
                        </div>
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

                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-[#192633]">
                          Reenvio sobrescreve a nota anterior (upsert).
                        </p>
                        <button
                          type="submit"
                          disabled={f.submitting}
                          className="btn-primary py-1.5 px-5 text-xs disabled:opacity-50"
                        >
                          {f.submitting ? 'Lançando…' : 'Lançar nota'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            }

            // ── ALUNO: boletim existente ─────────────────────────
            const media  = computeMedia(row.grades)
            const status = statusOf(media)

            return (
              <div
                key={row.subject.id}
                className="panel-hud overflow-hidden animate-fade-in"
                style={{ animationDelay: `${si * 55}ms` }}
              >
                {/* Subject header */}
                <div className="flex items-center justify-between border-b border-[#192633] bg-[#0b1117] px-5 py-3">
                  <div>
                    <span className="font-mono text-[10px] text-[#39ff85]">{row.subject.code}</span>
                    <p className="mt-0.5 text-xs font-semibold text-[#ccd8e0]">{row.subject.name}</p>
                  </div>
                  {!row.loading && !row.error && (
                    <span className={`badge ${status.cls}`}>{status.label}</span>
                  )}
                </div>

                {/* Loading grades */}
                {row.loading && (
                  <div className="flex items-center gap-2 px-5 py-4">
                    <div className="h-1 w-1 rounded-full bg-[#273a47] animate-pulse" />
                    <span className="text-[10px] text-[#273a47] animate-pulse">Carregando notas...</span>
                  </div>
                )}

                {/* Error fetching grades */}
                {!row.loading && row.error && (
                  <div className="px-5 py-4">
                    <span className="text-[10px] text-red-400/60">Falha ao carregar notas desta disciplina.</span>
                  </div>
                )}

                {/* No grades yet */}
                {!row.loading && !row.error && row.grades.length === 0 && (
                  <div className="px-5 py-4">
                    <span className="text-[10px] text-[#273a47]">Nenhuma nota lançada ainda.</span>
                  </div>
                )}

                {/* Grade rows */}
                {!row.loading && !row.error && row.grades.length > 0 && (
                  <>
                    <div
                      className="grid gap-3 border-b border-[#192633] bg-[#0b1117]/40 px-5 py-2 text-[9px] uppercase tracking-widest text-[#273a47]"
                      style={{ gridTemplateColumns: '1fr 80px 80px 72px' }}
                    >
                      <span>Avaliação</span>
                      <span className="text-right">Nota</span>
                      <span className="text-right">Máx</span>
                      <span className="text-right">/ 10</span>
                    </div>

                    {row.grades.map((g, gi) => {
                      const norm = normalizeGrade(g.score, g.maxScore)
                      return (
                        <div
                          key={g.id}
                          className="data-row grid items-center gap-3 border-b border-[#192633] px-5 py-3 last:border-0 animate-fade-in"
                          style={{ gridTemplateColumns: '1fr 80px 80px 72px', animationDelay: `${gi * 40}ms` }}
                        >
                          <span className="text-xs text-[#ccd8e0]">{g.assessmentName}</span>
                          <span className="text-right font-mono text-xs text-[#4a6172]">{g.score.toFixed(1)}</span>
                          <span className="text-right font-mono text-xs text-[#273a47]">{g.maxScore.toFixed(1)}</span>
                          <span className={`text-right font-mono text-sm font-bold ${gradeColor(norm)}`}>
                            {fmtGrade(norm)}
                          </span>
                        </div>
                      )
                    })}

                    {/* Media footer */}
                    <div className="border-t border-[#192633] bg-[#0b1117]/60 px-5 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-wider text-[#273a47]">Média final</span>
                        <span className={`font-mono text-lg font-bold ${gradeColor(media)}`}>
                          {fmtGrade(media)}
                        </span>
                      </div>
                      {media !== null && (
                        <div className="mt-2">
                          <div className="h-1 overflow-hidden rounded-full bg-[#192633]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                media >= 7.0 ? 'bg-[#39ff85]' : media >= 5.0 ? 'bg-[#f0c040]' : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min((media / 10) * 100, 100)}%` }}
                            />
                          </div>
                          <div className="relative mt-0.5 h-3">
                            <div className="absolute top-0 h-2 w-px bg-[#4a6172]/30" style={{ left: '70%' }} />
                            <span className="absolute top-1 text-[8px] text-[#273a47] -translate-x-1/2" style={{ left: '70%' }}>7,0</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Legenda (apenas aluno) ────────────────────────────── */}
      {!isProfessor && !loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#39ff85]">≥ 7,0</span>
            <span className="text-[10px] text-[#4a6172]">Aprovado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#f0c040]">5,0 – 6,9</span>
            <span className="text-[10px] text-[#4a6172]">Recuperação</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-red-400">{'< 5,0'}</span>
            <span className="text-[10px] text-[#4a6172]">Reprovado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#273a47]">—</span>
            <span className="text-[10px] text-[#4a6172]">Não lançado</span>
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-md border border-[#192633] bg-[#0b1117] px-4 py-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-70" />
          <span className="text-[10px] text-[#273a47]">
            {isProfessor
              ? 'Semestre ' + activeSemester + ' · Lançamento sobrescreve nota anterior para o mesmo aluno e avaliação.'
              : 'Notas do semestre ' + activeSemester + ' · Valor normalizado para escala 0–10. Em caso de divergência, contate a secretaria.'
            }
          </span>
        </div>
      )}

    </Layout>
  )
}
