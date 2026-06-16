import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../lib/api'

interface Subject {
  id: string
  code: string
  name: string
  professorName: string
  schedule: string | null
  room: string | null
  credits: number
  semester: { name: string; isActive: boolean }
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ subjects: Subject[] }>('/subjects/me')
      .then(({ data }) => setSubjects(data.subjects))
      .catch(() => setError('Não foi possível carregar as disciplinas.'))
      .finally(() => setLoading(false))
  }, [])

  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0)
  const activeSemester = subjects.find(s => s.semester.isActive)?.semester.name
    ?? subjects[0]?.semester.name
    ?? '—'

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-8">
        <p className="section-label mb-2">Área acadêmica</p>
        <h1 className="text-2xl font-bold text-[#ccd8e0]">
          Minhas <span className="neon-text">Disciplinas</span>
        </h1>

        {!loading && !error && subjects.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-xs text-[#4a6172]">
                {subjects.length} disciplina{subjects.length !== 1 ? 's' : ''} · Semestre {activeSemester}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-80" />
              <span className="text-xs text-[#4a6172]">{totalCredits} créditos matriculados</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#273a47]" />
              <span className="text-xs text-[#4a6172]">Todas em andamento</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
            <span className="text-xs text-[#4a6172] tracking-widest uppercase animate-pulse">
              Carregando disciplinas...
            </span>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-md border border-red-400/25 bg-red-400/8 px-4 py-3">
          <span className="text-sm text-red-400">✕</span>
          <p className="text-xs text-red-400/80">{error}</p>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && !error && subjects.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[#192633] bg-[#0f1820]">
            <svg className="h-7 w-7 text-[#273a47]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-[#273a47]">Nenhuma disciplina matriculada</p>
            <p className="mt-1.5 max-w-xs text-[11px] leading-relaxed text-[#192633]">
              Você ainda não está matriculado em nenhuma disciplina neste semestre.
              Em caso de dúvidas, entre em contato com a secretaria acadêmica.
            </p>
          </div>
        </div>
      )}

      {/* ── Subjects grid ────────────────────────────────────── */}
      {!loading && !error && subjects.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((sub, i) => (
              <div
                key={sub.id}
                className="panel-hud flex flex-col p-5 animate-fade-in"
                style={{ animationDelay: `${i * 55}ms` }}
              >
                {/* Top: code + credits */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#39ff85]">{sub.code}</span>
                  <span className="tag">{sub.credits} créditos</span>
                </div>

                {/* Name + professor */}
                <h2 className="mb-1 text-sm font-semibold leading-snug text-[#ccd8e0]">{sub.name}</h2>
                <p className="mb-4 text-[11px] text-[#4a6172]">{sub.professorName}</p>

                {/* Meta box */}
                <div className="mb-4 flex flex-col gap-1.5 rounded-md border border-[#192633] bg-[#0b1117] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-[#273a47]">Horário</span>
                    <span className="font-mono text-[10px] text-[#ccd8e0]">{sub.schedule ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-[#273a47]">Local</span>
                    <span className="font-mono text-[10px] text-[#ccd8e0]">{sub.room ?? '—'}</span>
                  </div>
                </div>

                {/* Quick links */}
                <div className="mt-auto flex gap-2">
                  <Link
                    to="/contents"
                    className="flex-1 rounded border border-[#192633] bg-[#0f1820] px-3 py-1.5 text-center text-[10px] text-[#4a6172] transition-colors hover:border-[#39ff8540] hover:text-[#39ff85]"
                  >
                    Conteúdos
                  </Link>
                  <Link
                    to="/attendance"
                    className="flex-1 rounded border border-[#192633] bg-[#0f1820] px-3 py-1.5 text-center text-[10px] text-[#4a6172] transition-colors hover:border-[#00c8ff40] hover:text-[#00c8ff]"
                  >
                    Presença
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* ── Status strip ─────────────────────────────────────── */}
          <div className="mt-6 flex items-center gap-3 rounded-md border border-[#192633] bg-[#0b1117] px-4 py-3">
            <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
            <span className="text-[10px] text-[#4a6172]">
              Semestre <span className="text-[#ccd8e0]">{activeSemester}</span> em andamento ·{' '}
              Dados atualizados pelo sistema acadêmico.
            </span>
          </div>
        </>
      )}

    </Layout>
  )
}
