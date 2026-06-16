import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../lib/api'
import keycloak from '../lib/keycloak'
import { useAuth } from '../context/AuthContext'

// ── Types ──────────────────────────────────────────────────────────

interface Course {
  id: string
  title: string
  description: string
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  estimatedHours: number | null
  instructorName: string | null
  createdAt: string
  _count: { modules: number; enrollments: number }
}

interface Module {
  id: string
  title: string
  description: string | null
  order: number
  durationMin: number | null
}

interface Question {
  id: string
  text: string
  options: string[]
  order: number
}

interface AnswerResult {
  selectedOption: number
  isCorrect: boolean
  correctAnswer: number
  explanation: string | null
}

interface QAPost {
  id: string
  question: string
  authorName: string
  answer: string | null
  createdAt: string
}

interface EnrollmentState {
  id: string
  completedModuleIds: Set<string>
  completedAt: string | null
}

interface EnrolledItem {
  id: string
  course: { id: string }
  completedAt: string | null
  progress: { moduleId: string }[]
}

type TabKey = 'overview' | 'modules' | 'questions' | 'qa'

// ── Helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDuration(min: number | null): string {
  if (!min) return ''
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function levelLabel(level: Course['level']): string {
  const map: Record<Course['level'], string> = {
    BEGINNER: 'Iniciante',
    INTERMEDIATE: 'Intermediário',
    ADVANCED: 'Avançado',
  }
  return map[level] ?? level
}

// ── Main component ─────────────────────────────────────────────────

export default function CourseDetailsPage() {
  const { id } = useParams<{ id: string }>()
  // useAuth fornece isAuthenticated como estado React reativo —
  // garante re-render quando keycloak.init() resolve de forma assíncrona.
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [course,     setCourse]     = useState<Course | null>(null)
  const [modules,    setModules]    = useState<Module[]>([])
  const [questions,  setQuestions]  = useState<Question[]>([])
  const [qaPosts,    setQaPosts]    = useState<QAPost[]>([])
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null)

  const [loading,         setLoading]         = useState(true)
  const [notFound,        setNotFound]        = useState(false)
  const [activeTab,       setActiveTab]       = useState<TabKey>('overview')
  const [enrolling,       setEnrolling]       = useState(false)
  const [enrollError,     setEnrollError]     = useState<string | null>(null)
  const [courseFinalized, setCourseFinalized] = useState(false)

  // Questions
  const [answerResults,   setAnswerResults]   = useState<Record<string, AnswerResult>>({})
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [submittingQ,     setSubmittingQ]     = useState<string | null>(null)

  // QA
  const [qaInput,      setQaInput]      = useState('')
  const [qaSubmitting, setQaSubmitting] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)

  // ── Efeito 1: dados públicos do curso (não depende de auth) ────
  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<{ course: Course }>(`/courses/${id}`)
        .then(r => setCourse(r.data.course))
        .catch(() => setNotFound(true)),
      api.get<{ modules: Module[] }>(`/courses/${id}/modules`)
        .then(r => setModules(r.data.modules))
        .catch(() => {}),
      api.get<{ questions: Question[] }>(`/courses/${id}/questions`)
        .then(r => setQuestions(r.data.questions))
        .catch(() => {}),
      api.get<{ posts: QAPost[] }>(`/courses/${id}/qa`)
        .then(r => setQaPosts(r.data.posts))
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [id])

  // ── Efeito 2: verifica matrícula — roda quando auth resolve ───
  // Separado do efeito 1 para reagir ao isAuthenticated do AuthContext,
  // que é atualizado depois que keycloak.init() resolve de forma assíncrona.
  useEffect(() => {
    if (!id || authLoading || !isAuthenticated) return
    api.get<{ enrollments: EnrolledItem[] }>('/courses/enrolled/me')
      .then(r => {
        const found = r.data.enrollments.find(e => e.course.id === id)
        if (found) {
          setEnrollment({
            id: found.id,
            completedModuleIds: new Set(found.progress.map(p => p.moduleId)),
            completedAt: found.completedAt,
          })
        }
      })
      .catch(() => {})
  }, [id, isAuthenticated, authLoading])

  // ── Enroll / Start course ─────────────────────────────────────
  async function handleStartCourse() {
    setEnrollError(null)

    if (!isAuthenticated) {
      // Redireciona para login; ao voltar, o efeito 2 buscará a matrícula.
      keycloak.login({ redirectUri: window.location.href })
      return
    }
    if (enrollment) {
      setActiveTab('modules')
      setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
      return
    }
    setEnrolling(true)
    try {
      const r = await api.post<{ enrollment: { id: string; courseId: string } }>(`/courses/${id}/enroll`, {})
      setEnrollment({ id: r.data.enrollment.id, completedModuleIds: new Set(), completedAt: null })
      setActiveTab('modules')
      setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        // Já matriculado — sincroniza estado local
        api.get<{ enrollments: EnrolledItem[] }>('/courses/enrolled/me')
          .then(r => {
            const found = r.data.enrollments.find(e => e.course.id === id)
            if (found) {
              setEnrollment({
                id: found.id,
                completedModuleIds: new Set(found.progress.map(p => p.moduleId)),
                completedAt: found.completedAt,
              })
              setActiveTab('modules')
            }
          })
          .catch(() => setEnrollError('Erro ao sincronizar matrícula. Recarregue a página.'))
      } else if (status === 401 || status === 403) {
        setEnrollError('Sessão expirada. Faça login novamente.')
      } else if (status === 404) {
        setEnrollError('Curso não encontrado no servidor.')
      } else {
        setEnrollError('Não foi possível realizar a matrícula. Tente novamente.')
      }
    } finally {
      setEnrolling(false)
    }
  }

  // ── Mark module complete ──────────────────────────────────────
  async function handleCompleteModule(moduleId: string) {
    if (!enrollment || enrollment.completedModuleIds.has(moduleId)) return
    try {
      const r = await api.post<{ courseFinalized: boolean }>(`/courses/${id}/progress`, { moduleId })
      setEnrollment(prev =>
        prev ? { ...prev, completedModuleIds: new Set([...prev.completedModuleIds, moduleId]) } : prev
      )
      if (r.data.courseFinalized) setCourseFinalized(true)
    } catch {}
  }

  // ── Answer question ───────────────────────────────────────────
  async function handleSelectAnswer(qid: string, optionIdx: number) {
    if (answerResults[qid] || submittingQ === qid || !enrollment) return
    setSelectedAnswers(prev => ({ ...prev, [qid]: optionIdx }))
    setSubmittingQ(qid)
    try {
      const r = await api.post<{ answer: AnswerResult; courseFinalized: boolean }>(
        `/courses/${id}/questions/${qid}/answer`,
        { selectedOption: optionIdx }
      )
      setAnswerResults(prev => ({ ...prev, [qid]: r.data.answer }))
      if (r.data.courseFinalized) setCourseFinalized(true)
    } catch (err: any) {
      if (err?.response?.status !== 409) {
        setSelectedAnswers(prev => { const n = { ...prev }; delete n[qid]; return n })
      }
    } finally {
      setSubmittingQ(null)
    }
  }

  // ── Submit QA question ────────────────────────────────────────
  async function handleQaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!qaInput.trim() || qaSubmitting) return
    setQaSubmitting(true)
    try {
      const r = await api.post<{ post: QAPost }>(`/courses/${id}/qa`, { question: qaInput.trim() })
      setQaPosts(prev => [...prev, r.data.post])
      setQaInput('')
    } catch {
    } finally {
      setQaSubmitting(false)
    }
  }

  // ── Loading ───────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col gap-4">
          <div className="skeleton h-3 w-32 rounded-full" />
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {[1, 2, 3].map(k => (
              <div key={k} className="panel p-5 flex flex-col gap-3">
                <div className="skeleton h-3 w-3/4" />
                {[1, 2, 3].map(j => <div key={j} className="skeleton h-2.5 w-full" />)}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  // ── Not found ─────────────────────────────────────────────────
  if (notFound || !course) {
    return (
      <Layout>
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#192633] bg-[#0f1820]">
            <svg className="h-9 w-9 text-[#273a47]" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.2}>
              <circle cx="24" cy="24" r="18" />
              <line x1="24" y1="14" x2="24" y2="26" />
              <circle cx="24" cy="32" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#273a47]">Curso não encontrado</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#192633]">
              O curso que você está buscando não existe ou foi removido do catálogo.
            </p>
          </div>
          <Link to="/courses" className="btn-ghost py-1.5 px-5 text-xs">← Voltar ao catálogo</Link>
        </div>
      </Layout>
    )
  }

  // ── Derived ───────────────────────────────────────────────────
  const completedCount = enrollment?.completedModuleIds.size ?? 0
  const correctCount   = Object.values(answerResults).filter(r => r.isCorrect).length
  // isAuthenticated vem do useAuth() no topo — estado React reativo.
  // Não usar keycloak.authenticated aqui pois é leitura de singleton não-reativa.

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview',   label: 'Visão Geral' },
    { key: 'modules',    label: 'Módulos',      count: modules.length },
    { key: 'questions',  label: 'Questões',     count: questions.length },
    { key: 'qa',         label: 'Tira-Dúvidas', count: qaPosts.length },
  ]

  // Enquanto o authLoading ainda está resolvendo, mostra estado neutro no botão.
  const startLabel = authLoading
    ? 'Aguardando sessão…'
    : enrolling
      ? 'Matriculando…'
      : enrollment
        ? 'Continuar curso →'
        : isAuthenticated
          ? 'Matricular-se →'
          : 'Entrar para começar →'

  // ── Render ────────────────────────────────────────────────────
  return (
    <Layout>

      {/* ── Breadcrumb ───────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-2 text-[10px] text-[#273a47]">
        <Link to="/courses" className="transition-colors hover:text-[#4a6172]">Cursos</Link>
        <span>›</span>
        <span className="text-[#4a6172]">{course.title}</span>
      </div>

      {/* ── Course finalized banner ───────────────────────────────── */}
      {courseFinalized && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-[#39ff8440] bg-[#39ff8510] px-5 py-3 animate-fade-in">
          <span className="text-lg">🎓</span>
          <div>
            <p className="text-sm font-bold text-[#39ff85]">Parabéns! Curso concluído.</p>
            <p className="text-[11px] text-[#39ff8580]">Seu certificado foi emitido automaticamente.</p>
          </div>
        </div>
      )}

      {/* ── Enroll error banner ───────────────────────────────────── */}
      {enrollError && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-[#ff445532] bg-[#ff445510] px-5 py-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-[10px] text-[#ff6070]">✕</span>
            <p className="text-xs text-[#ff6070]">{enrollError}</p>
          </div>
          <button
            onClick={() => setEnrollError(null)}
            className="shrink-0 text-[10px] text-[#ff607060] hover:text-[#ff6070] transition-colors"
          >
            fechar
          </button>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div className="panel-hud mb-8 overflow-hidden animate-fade-in">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#39ff8505] via-transparent to-[#00c8ff03]" />

        <div className="relative p-6 sm:p-8">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="badge badge-blue">Público</span>
            <span className="badge badge-green">Gratuito</span>
            <span className="rounded-full border border-[#192633] bg-transparent px-2.5 py-0.5 text-[10px] font-semibold text-[#273a47]">
              {levelLabel(course.level)}
            </span>
            {enrollment && (
              <span className="rounded-full border border-[#39ff8440] bg-[#39ff8510] px-2.5 py-0.5 text-[10px] font-semibold text-[#39ff85]">
                Matriculado
              </span>
            )}
            <span className="ml-auto font-mono text-[9px] text-[#273a47]">
              Publicado em {fmtDate(course.createdAt)}
            </span>
          </div>

          <h1 className="mb-3 text-2xl font-bold leading-snug text-[#ccd8e0] sm:text-3xl">
            {course.title}
          </h1>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#4a6172]">
            {course.description}
          </p>

          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Módulos',   value: modules.length },
              { label: 'Questões',  value: questions.length },
              ...(course.estimatedHours ? [{ label: 'Horas',  value: `~${course.estimatedHours}h` }] : []),
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2 rounded-md border border-[#192633] bg-[#0b1117] px-3 py-2">
                <span className="text-[9px] uppercase tracking-wider text-[#273a47]">{stat.label}</span>
                <span className="font-mono text-xs font-bold text-[#ccd8e0]">{stat.value}</span>
              </div>
            ))}
            <div className="ml-auto">
              <button
                className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleStartCourse}
                disabled={enrolling || authLoading}
              >
                {startLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="relative border-t border-[#192633] bg-[#0b1117] px-6 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-1 w-1 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-[9px] uppercase tracking-widest text-[#273a47]">
                {course.instructorName ?? 'Curso público'} · {course._count.enrollments} alunos
              </span>
            </div>
            {enrollment && modules.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-[9px] text-[#39ff8580]">
                    {completedCount}/{modules.length} módulos
                  </span>
                  <div className="h-1 w-24 overflow-hidden rounded-full bg-[#192633]">
                    <div
                      className="h-full rounded-full bg-[#39ff85] transition-all"
                      style={{ width: `${(completedCount / modules.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab navigation ───────────────────────────────────────── */}
      <div ref={contentRef} className="mb-6 overflow-x-auto">
        <div className="flex min-w-max items-end gap-0 border-b border-[#192633]">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-1.5 px-4 pb-2.5 pt-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-[#39ff85]' : 'text-[#273a47] hover:text-[#4a6172]'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`font-mono text-[9px] ${isActive ? 'text-[#39ff8580]' : 'text-[#192633]'}`}>
                    {tab.count}
                  </span>
                )}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#39ff85]"
                    style={{ boxShadow: '0 0 6px #39ff8566' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab: Visão Geral ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="animate-fade-in space-y-4">
          <div className="panel p-6">
            <p className="section-label mb-4">Sobre o curso</p>
            <p className="text-sm leading-relaxed text-[#4a6172]">{course.description}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-5">
              <p className="section-label mb-4">Conteúdo do curso</p>
              {modules.length === 0 ? (
                <p className="text-xs text-[#273a47]">Nenhum módulo disponível ainda.</p>
              ) : (
                <ul className="space-y-2.5">
                  {modules.map((m, i) => (
                    <li key={m.id} className="flex items-start gap-2.5">
                      <span className="mt-px shrink-0 font-mono text-[10px] text-[#273a47]">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#4a6172] leading-snug">{m.title}</p>
                        {m.durationMin && (
                          <p className="mt-0.5 font-mono text-[9px] text-[#192633]">{fmtDuration(m.durationMin)}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel p-5">
              <p className="section-label mb-4">Informações</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <span className="mt-px shrink-0 font-mono text-[10px] text-[#273a47]">›</span>
                  <span className="text-xs text-[#4a6172]">Nível: <strong className="text-[#ccd8e0]">{levelLabel(course.level)}</strong></span>
                </li>
                {course.estimatedHours && (
                  <li className="flex items-start gap-2.5">
                    <span className="mt-px shrink-0 font-mono text-[10px] text-[#273a47]">›</span>
                    <span className="text-xs text-[#4a6172]">Carga horária: <strong className="text-[#ccd8e0]">~{course.estimatedHours}h</strong></span>
                  </li>
                )}
                {course.instructorName && (
                  <li className="flex items-start gap-2.5">
                    <span className="mt-px shrink-0 font-mono text-[10px] text-[#273a47]">›</span>
                    <span className="text-xs text-[#4a6172]">Instrutor: <strong className="text-[#ccd8e0]">{course.instructorName}</strong></span>
                  </li>
                )}
                <li className="flex items-start gap-2.5">
                  <span className="mt-px shrink-0 font-mono text-[10px] text-[#273a47]">›</span>
                  <span className="text-xs text-[#4a6172]">Acesso: <strong className="text-[#ccd8e0]">Gratuito e público</strong></span>
                </li>
              </ul>
              <div className="mt-5 border-t border-[#192633] pt-4">
                <p className="section-label mb-2">Alunos matriculados</p>
                <p className="font-mono text-xs text-[#ccd8e0]">{course._count.enrollments}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Módulos ─────────────────────────────────────────── */}
      {activeTab === 'modules' && (
        <div className="animate-fade-in">
          <div className="mb-5 flex items-center justify-between">
            <p className="section-label">Módulos do curso</p>
            {enrollment && modules.length > 0 && (
              <span className="font-mono text-[10px] text-[#273a47]">
                {completedCount}/{modules.length} concluídos
              </span>
            )}
          </div>

          {modules.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-sm text-[#273a47]">Módulos em breve.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((m, i) => {
                const done = enrollment?.completedModuleIds.has(m.id) ?? false
                return (
                  <div
                    key={m.id}
                    className={`panel flex items-start gap-4 p-4 transition-colors ${
                      done ? 'border-[#39ff8425] bg-[#39ff8506]' : ''
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                      done
                        ? 'border-[#39ff8440] bg-[#39ff8512] text-[#39ff85]'
                        : 'border-[#192633] bg-[#0f1820] text-[#273a47]'
                    }`}>
                      {done ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="font-mono text-[10px]">{String(i + 1).padStart(2, '0')}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className={`text-xs font-semibold leading-snug ${done ? 'text-[#ccd8e0]' : 'text-[#4a6172]'}`}>
                          {m.title}
                        </p>
                        {m.durationMin && (
                          <span className="font-mono text-[9px] text-[#273a47]">{fmtDuration(m.durationMin)}</span>
                        )}
                      </div>
                      {m.description && (
                        <p className="text-[11px] leading-relaxed text-[#273a47]">{m.description}</p>
                      )}
                    </div>

                    {enrollment && !done && (
                      <button
                        onClick={() => handleCompleteModule(m.id)}
                        className="shrink-0 rounded border border-[#192633] bg-[#0f1820] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#273a47] transition-colors hover:border-[#39ff8440] hover:text-[#39ff85]"
                      >
                        Concluir
                      </button>
                    )}
                    {done && (
                      <span className="shrink-0 font-mono text-[9px] text-[#39ff8580]">Concluído</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!enrollment && (
            <div className="mt-5 rounded-md border border-[#192633] bg-[#0b1117] px-5 py-4 text-center">
              <p className="text-xs text-[#273a47]">Matricule-se para acompanhar seu progresso.</p>
              <button onClick={handleStartCourse} className="mt-3 btn-primary py-1.5 px-5 text-xs">
                {isAuthenticated ? 'Matricular-se' : 'Entrar para matricular'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Questões ────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div className="animate-fade-in">
          <div className="mb-5 flex items-center justify-between">
            <p className="section-label">Questões de fixação</p>
            {Object.keys(answerResults).length > 0 && (
              <span className="font-mono text-[10px] text-[#273a47]">
                {correctCount}/{questions.length} corretas
              </span>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-sm text-[#273a47]">Questões em breve.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {questions.map((q, qi) => {
                const result   = answerResults[q.id]
                const selected = selectedAnswers[q.id]
                const revealed = result !== undefined
                const pending  = submittingQ === q.id

                return (
                  <div key={q.id} className="panel p-5">
                    <div className="mb-4 flex items-start gap-2.5">
                      <span className="mt-px shrink-0 font-mono text-[10px] text-[#273a47]">Q{qi + 1}</span>
                      <p className="text-sm font-medium leading-relaxed text-[#ccd8e0]">{q.text}</p>
                    </div>

                    {!enrollment ? (
                      <div className="rounded-md border border-[#192633] bg-[#0b1117] px-4 py-3 text-center">
                        <p className="text-[11px] text-[#273a47]">Matricule-se para responder as questões.</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {(q.options as string[]).map((opt, oi) => {
                            let cls = 'border-[#192633] bg-[#0f1820] text-[#4a6172] hover:border-[#24364a] hover:text-[#ccd8e0]'
                            if (revealed) {
                              if (oi === result.correctAnswer)    cls = 'border-[#39ff8440] bg-[#39ff8510] text-[#39ff85]'
                              else if (oi === result.selectedOption) cls = 'border-[#ff445532] bg-[#ff445510] text-[#ff6070]'
                              else                                  cls = 'border-[#192633] bg-[#0f1820] text-[#273a47] opacity-40'
                            } else if (pending && oi === selected) {
                              cls = 'border-[#24364a] bg-[#0f1820] text-[#ccd8e0] opacity-60'
                            }
                            return (
                              <button
                                key={oi}
                                onClick={() => handleSelectAnswer(q.id, oi)}
                                disabled={revealed || pending}
                                className={`w-full rounded-md border px-4 py-2.5 text-left text-xs transition-colors ${cls} ${revealed || pending ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <span className="mr-2 font-mono text-[9px] opacity-50">{String.fromCharCode(65 + oi)}.</span>
                                {opt}
                              </button>
                            )
                          })}
                        </div>

                        {revealed && (
                          <div className={`mt-3 rounded-md border p-3 ${
                            result.isCorrect ? 'border-[#39ff8525] bg-[#39ff8508]' : 'border-[#ff445525] bg-[#ff445508]'
                          }`}>
                            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${result.isCorrect ? 'text-[#39ff85]' : 'text-[#ff6070]'}`}>
                              {result.isCorrect ? '✓ Correto' : '✗ Incorreto'}
                            </p>
                            {result.explanation && (
                              <p className="text-[11px] leading-relaxed text-[#4a6172]">{result.explanation}</p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {Object.keys(answerResults).length === questions.length && questions.length > 0 && enrollment && (
            <div className="mt-5 flex items-center justify-between rounded-md border border-[#192633] bg-[#0b1117] px-5 py-3">
              <span className="text-xs text-[#4a6172]">
                Resultado: <span className="font-mono font-bold text-[#ccd8e0]">{correctCount}/{questions.length}</span> corretas
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Tira-Dúvidas ────────────────────────────────────── */}
      {activeTab === 'qa' && (
        <div className="animate-fade-in">
          <p className="section-label mb-5">Tira-dúvidas público</p>

          {qaPosts.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-sm text-[#273a47]">Nenhuma pergunta ainda. Seja o primeiro!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {qaPosts.map(item => {
                const initials = item.authorName.split(' ').map(w => w[0]).slice(0, 2).join('')
                return (
                  <div key={item.id} className="panel p-5">
                    {/* Question */}
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#192633] bg-[#0f1820]">
                        <span className="font-mono text-[9px] font-bold text-[#273a47]">{initials}</span>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[#4a6172]">{item.authorName}</span>
                          <span className="text-[9px] text-[#192633]">·</span>
                          <span className="text-[9px] text-[#273a47]">{fmtDate(item.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-[#ccd8e0]">{item.question}</p>
                      </div>
                    </div>

                    {/* Answer */}
                    {item.answer ? (
                      <div className="ml-10 flex items-start gap-3 rounded-md border border-[#192633] bg-[#070b0e] px-4 py-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#39ff8430] bg-[#39ff8510]">
                          <span className="text-[9px] font-bold text-[#39ff85]">✓</span>
                        </div>
                        <div>
                          <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-[#39ff8560]">
                            Resposta oficial
                          </p>
                          <p className="text-xs leading-relaxed text-[#4a6172]">{item.answer}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-10 rounded-md border border-[#192633] bg-[#070b0e] px-4 py-2.5">
                        <p className="text-[10px] text-[#192633]">Aguardando resposta…</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* New question form */}
          {isAuthenticated ? (
            <form onSubmit={handleQaSubmit} className="mt-5">
              <p className="section-label mb-3">Enviar pergunta</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={qaInput}
                  onChange={e => setQaInput(e.target.value)}
                  maxLength={500}
                  placeholder="Sua dúvida sobre este curso…"
                  className="flex-1 rounded-md border border-[#192633] bg-[#0b1117] px-4 py-2.5 text-xs text-[#ccd8e0] placeholder-[#273a47] outline-none focus:border-[#39ff8440] focus:ring-0 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!qaInput.trim() || qaSubmitting}
                  className="btn-primary px-4 py-2.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {qaSubmitting ? 'Enviando…' : 'Enviar'}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-5 rounded-md border border-[#192633] bg-[#0b1117] px-5 py-4 text-center">
              <p className="text-xs text-[#273a47]">Tem uma dúvida sobre este curso?</p>
              <p className="mt-1 text-[10px] text-[#192633]">Faça login no portal para enviar perguntas.</p>
            </div>
          )}
        </div>
      )}

      {/* ── CTA strip ────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-[#192633] bg-[#0b1117] px-5 py-4">
        <div>
          <p className="text-xs font-semibold text-[#ccd8e0]">
            {enrollment ? 'Continue de onde parou.' : 'Pronto para começar?'}
          </p>
          <p className="text-[10px] text-[#273a47]">
            {enrollment ? `${completedCount}/${modules.length} módulos concluídos.` : 'Acesso gratuito, sem cadastro.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/courses" className="btn-ghost py-1.5 px-4 text-xs">← Catálogo</Link>
          <button
            className="btn-primary py-1.5 px-4 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleStartCourse}
            disabled={enrolling || authLoading}
          >
            {startLabel}
          </button>
        </div>
      </div>

    </Layout>
  )
}
