import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

// ── Constants ─────────────────────────────────────────────────────

const MIN_ATTENDANCE = 75 // %

// ── Interfaces ────────────────────────────────────────────────────

interface Subject {
  id: string
  code: string
  name: string
  semester: { name: string; isActive: boolean }
}

interface AttendanceSummary {
  attended: number
  total: number
}

interface Lesson {
  id: string
  title: string
  date: string
  present: boolean | null
}

interface SubjectAttendance {
  subject: Subject
  summary: AttendanceSummary | null
  lessons: Lesson[]
  loading: boolean
  error: boolean
}

interface LessonFormState {
  userId: string
  present: boolean | null
  submitting: boolean
  success: boolean
  error: string | null
}

// ── Helpers ───────────────────────────────────────────────────────

function pct(attended: number, total: number): number {
  return total === 0 ? 0 : Math.round((attended / total) * 100)
}

function barColor(p: number): string {
  if (p >= 85) return 'bg-[#39ff85]'
  if (p >= 75) return 'bg-[#00c8ff]'
  if (p >= 60) return 'bg-[#f0c040]'
  return 'bg-red-400'
}

function statusOf(p: number): { label: string; cls: string } {
  if (p >= MIN_ATTENDANCE) return { label: 'Regular', cls: 'badge-green'  }
  if (p >= 60)             return { label: 'Atenção', cls: 'badge-yellow' }
  return                          { label: 'Risco',   cls: 'badge-red'    }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Component ─────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user } = useAuth()
  const isProfessor = (user?.roles ?? []).some(r => r === 'professor' || r === 'admin')

  const [rows, setRows] = useState<SubjectAttendance[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(true)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)

  // Professor: form state per lesson
  const [lessonForms, setLessonForms] = useState<Record<string, LessonFormState>>({})

  function getLessonForm(lid: string): LessonFormState {
    return lessonForms[lid] ?? { userId: '', present: null, submitting: false, success: false, error: null }
  }

  function patchLessonForm(lid: string, patch: Partial<LessonFormState>) {
    setLessonForms(prev => ({ ...prev, [lid]: { ...getLessonForm(lid), ...patch } }))
  }

  async function handleAttendanceSubmit(lessonId: string, subjectId: string, e: React.FormEvent) {
    e.preventDefault()
    const f = getLessonForm(lessonId)

    if (!f.userId.trim() || f.present === null) {
      patchLessonForm(lessonId, { error: 'Preencha o UUID do aluno e selecione o status.' })
      return
    }

    patchLessonForm(lessonId, { submitting: true, error: null, success: false })

    try {
      await api.post(`/subjects/${subjectId}/attendance`, {
        lessonId,
        userId: f.userId.trim(),
        present: f.present,
      })
      patchLessonForm(lessonId, {
        userId: '', present: null,
        submitting: false, success: true, error: null,
      })
    } catch (err: any) {
      const msg    = err?.response?.data?.error
      const errMsg = typeof msg === 'string' ? msg : 'Erro ao registrar presença. Verifique os dados.'
      patchLessonForm(lessonId, { submitting: false, error: errMsg, success: false })
    }
  }

  // Fetch subjects, then attendance per subject
  useEffect(() => {
    api.get<{ subjects: Subject[] }>('/subjects/me')
      .then(({ data }) => {
        const initial = data.subjects.map(subject => ({
          subject,
          summary: null,
          lessons: [],
          loading: true,
          error: false,
        }))
        setRows(initial)
        setLoadingSubjects(false)

        data.subjects.forEach((subject, idx) => {
          api.get<{ summary: AttendanceSummary; lessons: Lesson[] }>(`/subjects/${subject.id}/attendance`)
            .then(({ data: d }) => {
              setRows(prev =>
                prev.map((r, i) => i === idx
                  ? { ...r, summary: d.summary, lessons: d.lessons ?? [], loading: false }
                  : r
                )
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
        setSubjectsError('Não foi possível carregar a frequência.')
        setLoadingSubjects(false)
      })
  }, [])

  const activeSemester = rows[0]?.subject.semester.name ?? '—'
  const allLoaded = !loadingSubjects && rows.every(r => !r.loading)

  // Aluno: disciplinas em risco
  const atRisk = rows.filter(r =>
    !r.loading && !r.error && r.summary !== null &&
    pct(r.summary.attended, r.summary.total) < MIN_ATTENDANCE
  )

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-8">
        <p className="section-label mb-2">Área acadêmica</p>
        <h1 className="text-2xl font-bold text-[#ccd8e0]">
          {isProfessor
            ? <>Diário de <span className="neon-text">Presença</span></>
            : <>Frequência <span className="neon-text">por Disciplina</span></>
          }
        </h1>

        {allLoaded && !subjectsError && rows.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-xs text-[#4a6172]">
                {rows.length} disciplina{rows.length !== 1 ? 's' : ''} · Semestre {activeSemester}
              </span>
            </div>
            {!isProfessor && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#273a47]" />
                <span className="text-xs text-[#4a6172]">Mínimo: {MIN_ATTENDANCE}% de presença</span>
              </div>
            )}
            {!isProfessor && atRisk.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#f0c040]" />
                <span className="text-xs text-[#4a6172]">{atRisk.length} abaixo do mínimo</span>
              </div>
            )}
            {isProfessor && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-80" />
                <span className="text-xs text-[#4a6172]">Registro sobrescreve entrada anterior (upsert)</span>
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
              Carregando frequência...
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#273a47]">
              {isProfessor ? 'Nenhuma disciplina encontrada' : 'Nenhuma frequência registrada'}
            </p>
            <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-[#192633]">
              {isProfessor
                ? 'Nenhuma disciplina vinculada à sua conta de docente.'
                : 'Não há registros de presença para o semestre atual. Os dados são lançados pelo professor via diário eletrônico.'
              }
            </p>
          </div>
        </div>
      )}

      {/* ── Alert: frequência baixa (apenas aluno) ───────────── */}
      {!isProfessor && allLoaded && atRisk.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-[#f0c040]/25 bg-[#f0c040]/6 px-4 py-3 animate-fade-in">
          <span className="mt-0.5 text-sm text-[#f0c040]">⚠</span>
          <div>
            <p className="text-xs font-semibold text-[#f0c040]">Frequência abaixo do mínimo</p>
            <p className="mt-0.5 text-[10px] text-[#f0c040]/70">
              {atRisk.map(r => r.subject.name).join(', ')} — risco de reprovação por faltas.
            </p>
          </div>
        </div>
      )}

      {/* ── Conteúdo por disciplina ───────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="flex flex-col gap-4">
          {rows.map((row, i) => {

            // ── PROFESSOR: diário de aulas ───────────────────────
            if (isProfessor) {
              return (
                <div
                  key={row.subject.id}
                  className="panel-hud overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#192633] bg-[#0b1117] px-5 py-3">
                    <div>
                      <span className="font-mono text-[10px] text-[#39ff85]">{row.subject.code}</span>
                      <p className="mt-0.5 text-xs font-semibold text-[#ccd8e0]">{row.subject.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!row.loading && (
                        <span className="font-mono text-[9px] text-[#273a47]">
                          {row.lessons.length} aula{row.lessons.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="badge badge-blue">Docente</span>
                    </div>
                  </div>

                  {/* Loading */}
                  {row.loading && (
                    <div className="flex items-center gap-2 px-5 py-4">
                      <div className="h-1 w-1 rounded-full bg-[#273a47] animate-pulse" />
                      <span className="text-[10px] text-[#273a47] animate-pulse">Carregando aulas...</span>
                    </div>
                  )}

                  {/* Error */}
                  {!row.loading && row.error && (
                    <div className="px-5 py-4">
                      <span className="text-[10px] text-red-400/60">Falha ao carregar aulas desta disciplina.</span>
                    </div>
                  )}

                  {/* Sem aulas */}
                  {!row.loading && !row.error && row.lessons.length === 0 && (
                    <div className="px-5 py-4">
                      <span className="text-[10px] text-[#273a47]">Nenhuma aula cadastrada para esta disciplina.</span>
                    </div>
                  )}

                  {/* Lista de aulas com formulário por aula */}
                  {!row.loading && !row.error && row.lessons.length > 0 && (
                    <div className="divide-y divide-[#192633]">
                      {row.lessons.map(lesson => {
                        const lf = getLessonForm(lesson.id)
                        return (
                          <div key={lesson.id} className="px-5 py-4">
                            {/* Lesson info */}
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold text-[#ccd8e0]">{lesson.title}</p>
                                <p className="mt-0.5 font-mono text-[10px] text-[#273a47]">
                                  {fmtDate(lesson.date)}
                                </p>
                              </div>
                              <span className="font-mono text-[9px] text-[#192633]">{lesson.id.slice(-8)}</span>
                            </div>

                            {/* Attendance form */}
                            <form
                              onSubmit={e => handleAttendanceSubmit(lesson.id, row.subject.id, e)}
                              className="flex flex-col gap-2"
                            >
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="sm:col-span-2">
                                  <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                                    UUID do aluno
                                  </label>
                                  <input
                                    type="text"
                                    value={lf.userId}
                                    onChange={e => patchLessonForm(lesson.id, { userId: e.target.value, success: false, error: null })}
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    className="input-cyber font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="mb-1 block text-[9px] uppercase tracking-wider text-[#273a47]">
                                    Status
                                  </label>
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => patchLessonForm(lesson.id, { present: true, success: false })}
                                      className={`flex-1 rounded border py-1.5 text-[10px] font-semibold transition-colors ${
                                        lf.present === true
                                          ? 'border-[#39ff8440] bg-[#39ff8510] text-[#39ff85]'
                                          : 'border-[#192633] bg-[#0f1820] text-[#273a47] hover:border-[#39ff8430] hover:text-[#39ff85]'
                                      }`}
                                    >
                                      ✓ Pres.
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => patchLessonForm(lesson.id, { present: false, success: false })}
                                      className={`flex-1 rounded border py-1.5 text-[10px] font-semibold transition-colors ${
                                        lf.present === false
                                          ? 'border-red-400/40 bg-red-400/10 text-red-400'
                                          : 'border-[#192633] bg-[#0f1820] text-[#273a47] hover:border-red-400/30 hover:text-red-400/80'
                                      }`}
                                    >
                                      ✕ Aus.
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {lf.success && (
                                <span className="text-[10px] text-[#39ff85]">✓ Presença registrada com sucesso.</span>
                              )}
                              {lf.error && (
                                <span className="text-[10px] text-red-400">✕ {lf.error}</span>
                              )}

                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  disabled={lf.submitting || lf.present === null || !lf.userId.trim()}
                                  className="btn-primary py-1 px-4 text-xs disabled:opacity-50"
                                >
                                  {lf.submitting ? 'Registrando…' : 'Registrar'}
                                </button>
                              </div>
                            </form>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // ── ALUNO: frequência existente ──────────────────────
            const summary = row.summary ?? { attended: 0, total: 0 }
            const p    = pct(summary.attended, summary.total)
            const s    = statusOf(p)
            const risk = p < MIN_ATTENDANCE && summary.total > 0

            return (
              <div
                key={row.subject.id}
                className={`panel-hud ${risk ? 'panel-hud-cyan' : ''} p-5 animate-fade-in`}
                style={{ animationDelay: `${i * 55}ms` }}
              >
                {/* Top row */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[#39ff85]">{row.subject.code}</span>
                      {!row.loading && !row.error && summary.total > 0 && (
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-[#ccd8e0]">{row.subject.name}</p>
                  </div>

                  {row.loading && (
                    <div className="h-1 w-12 rounded bg-[#192633] animate-pulse" />
                  )}
                  {!row.loading && row.error && (
                    <span className="text-[10px] text-red-400/60">Falha ao carregar</span>
                  )}
                  {!row.loading && !row.error && summary.total === 0 && (
                    <span className="text-[10px] text-[#273a47]">Sem aulas registradas</span>
                  )}
                  {!row.loading && !row.error && summary.total > 0 && (
                    <div className="text-right">
                      <p className={`font-mono text-2xl font-bold ${barColor(p).replace('bg-', 'text-')}`}>{p}%</p>
                      <p className="text-[10px] text-[#273a47]">{summary.attended} / {summary.total} aulas</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {!row.loading && !row.error && summary.total > 0 && (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#192633]">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(p)}`}
                        style={{ width: `${p}%` }}
                      />
                    </div>

                    <div className="relative mt-1">
                      <div className="absolute top-0 h-2 w-px bg-[#4a6172]/40" style={{ left: `${MIN_ATTENDANCE}%` }} />
                      <p
                        className="absolute top-2 text-[8px] text-[#273a47] -translate-x-1/2"
                        style={{ left: `${MIN_ATTENDANCE}%` }}
                      >
                        75%
                      </p>
                    </div>

                    <div className="mt-5 flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85]" />
                        <span className="text-[10px] text-[#4a6172]">{summary.attended} presentes</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-400/60" />
                        <span className="text-[10px] text-[#4a6172]">
                          {summary.total - summary.attended} faltas
                        </span>
                      </div>
                      <div className="ml-auto">
                        {risk ? (
                          <span className="text-[10px] text-[#f0c040]">
                            Faltam {Math.ceil((MIN_ATTENDANCE / 100) * summary.total) - summary.attended} presenças para regularizar
                          </span>
                        ) : (() => {
                          const remaining = Math.floor((1 - MIN_ATTENDANCE / 100) * summary.total) - (summary.total - summary.attended)
                          return remaining > 0 ? (
                            <span className="text-[10px] text-[#273a47]">
                              Pode faltar mais {remaining} aula{remaining !== 1 ? 's' : ''}
                            </span>
                          ) : null
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────── */}
      {!loadingSubjects && !subjectsError && rows.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-md border border-[#192633] bg-[#0b1117] px-4 py-3">
          <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-70" />
          <span className="text-[10px] text-[#273a47]">
            {isProfessor
              ? `Semestre ${activeSemester} · Registros via diário eletrônico. Upsert por aula + aluno.`
              : `Frequência do semestre ${activeSemester} · Registrada pelo professor via diário eletrônico. Abaixo de ${MIN_ATTENDANCE}% = reprovação por falta.`
            }
          </span>
        </div>
      )}

    </Layout>
  )
}
