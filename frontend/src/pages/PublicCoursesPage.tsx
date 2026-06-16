import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import api from '../lib/api'

interface Course {
  id: string
  title: string
  description: string
  createdAt: string
}

// ── Helpers ─────────────────────────────────────────────────────

function courseAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'adicionado hoje'
  if (days === 1) return 'há 1 dia'
  if (days < 30)  return `há ${days} dias`
  const months = Math.floor(days / 30)
  return months === 1 ? 'há 1 mês' : `há ${months} meses`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Skeletons ────────────────────────────────────────────────────

function SkeletonHero() {
  return (
    <div className="panel mb-8 p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2">
        <div className="skeleton h-4 w-24 rounded-full" />
        <div className="skeleton h-4 w-16 rounded-full" />
        <div className="ml-auto skeleton h-3 w-20" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_200px]">
        <div>
          <div className="skeleton h-2.5 w-36 mb-3" />
          <div className="skeleton h-7 w-3/4 mb-4" />
          <div className="flex flex-col gap-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-11/12" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        </div>
        <div className="hidden lg:flex flex-col justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="skeleton h-2.5 w-16" />
            <div className="skeleton h-3 w-24" />
          </div>
          <div className="skeleton h-9 w-full rounded" />
        </div>
      </div>
      <div className="mt-6 border-t border-[#192633] pt-3">
        <div className="skeleton h-2.5 w-48" />
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-2.5 w-8" />
        <div className="skeleton h-4 w-14 rounded-full" />
      </div>
      <div className="skeleton h-4 w-3/4" />
      <div className="flex flex-col gap-1.5">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-5/6" />
        <div className="skeleton h-3 w-2/3" />
      </div>
      <div className="h-px bg-[#192633]" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-6 w-24 rounded" />
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function PublicCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    api.get<{ courses: Course[] }>('/courses/public')
      .then((res) => setCourses(res.data.courses))
      .catch(() => setError('Não foi possível carregar os cursos. Tente novamente mais tarde.'))
      .finally(() => setLoading(false))
  }, [])

  // Mais recente primeiro
  const sorted = [...courses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const featured  = sorted[0] ?? null
  const remaining = sorted.slice(1)

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-8">
        <p className="section-label mb-2">Catálogo público</p>
        <h1 className="text-2xl font-bold text-[#ccd8e0]">
          Cursos <span className="neon-text">Preparatórios</span>
        </h1>

        {!loading && !error && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-xs text-[#4a6172]">
                {courses.length === 0
                  ? 'Nenhum curso ainda'
                  : `${courses.length} ${courses.length === 1 ? 'curso' : 'cursos'} disponíve${courses.length !== 1 ? 'is' : 'l'}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-80" />
              <span className="text-xs text-[#4a6172]">Acesso gratuito · sem login</span>
            </div>
            {featured && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#273a47]" />
                <span className="text-xs text-[#4a6172]">
                  Atualizado {courseAge(featured.createdAt)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 rounded-md border border-red-500/25 bg-red-500/8 px-4 py-3">
          <span className="mt-0.5 text-sm text-red-400">⚠</span>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <>
          <SkeletonHero />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!loading && !error && courses.length === 0 && (
        <div className="flex flex-col items-center gap-5 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#192633] bg-[#0f1820]">
            <svg className="w-9 h-9 text-[#273a47]" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.2}>
              <rect x="6" y="4" width="36" height="40" rx="3" />
              <line x1="14" y1="16" x2="34" y2="16" />
              <line x1="14" y1="24" x2="34" y2="24" />
              <line x1="14" y1="32" x2="24" y2="32" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#273a47]">Catálogo ainda vazio</p>
            <p className="mt-2 max-w-xs mx-auto text-xs leading-relaxed text-[#192633]">
              Nenhum curso preparatório foi adicionado ainda. Volte em breve.
            </p>
          </div>
        </div>
      )}

      {/* ── Featured hero ─────────────────────────────────────── */}
      {!loading && !error && featured && (
        <div className="panel-hud mb-8 animate-fade-in overflow-hidden">
          {/* Subtle ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#39ff8505] via-transparent to-[#00c8ff03]" />

          <div className="relative p-6 sm:p-8">
            {/* Top badges row */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="badge badge-green">Em destaque</span>
              <span className="badge badge-blue">Público</span>
              <span className="ml-auto font-mono text-[9px] text-[#273a47]">
                {courseAge(featured.createdAt)}
              </span>
            </div>

            {/* Editorial layout: 2-col on lg */}
            <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
              <div>
                <p className="mb-2 font-mono text-[10px] text-[#39ff85]">
                  #01 — Mais recente do catálogo
                </p>
                <h2 className="mb-4 text-xl font-bold leading-snug text-[#ccd8e0] sm:text-2xl">
                  {featured.title}
                </h2>
                <p className="text-sm leading-relaxed text-[#4a6172]">
                  {featured.description}
                </p>
              </div>

              {/* Right col: date + CTA */}
              <div className="flex flex-col justify-between gap-4 lg:items-end">
                <div className="rounded-md border border-[#192633] bg-[#0b1117] px-3 py-2.5 text-right">
                  <p className="text-[9px] uppercase tracking-widest text-[#273a47]">Adicionado</p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#ccd8e0]">{fmtDate(featured.createdAt)}</p>
                </div>
                <Link to={`/courses/${featured.id}`} className="btn-primary w-full justify-center lg:w-auto text-sm">
                  Acesso gratuito →
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom info strip */}
          <div className="relative border-t border-[#192633] bg-[#0b1117] px-6 py-2.5">
            <div className="flex items-center gap-3">
              <div className="h-1 w-1 rounded-full bg-[#39ff85] animate-pulse-neon" />
              <span className="text-[9px] uppercase tracking-widest text-[#273a47]">
                Disponível · Acesso imediato · Conteúdo gratuito
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Remaining courses ─────────────────────────────────── */}
      {!loading && !error && remaining.length > 0 && (
        <>
          {/* Section divider */}
          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#192633]" />
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#273a47]">
              Outros cursos
            </span>
            <div className="h-px flex-1 bg-[#192633]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {remaining.map((course, i) => {
              const hudClass = i % 2 === 0 ? 'panel-hud panel-hud-cyan' : 'panel-hud'

              return (
                <div
                  key={course.id}
                  className={`${hudClass} flex flex-col p-5 animate-fade-in`}
                  style={{ animationDelay: `${(i + 1) * 60}ms` }}
                >
                  {/* Top: catalog number + badge */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[#273a47]">
                      #{String(i + 2).padStart(2, '0')}
                    </span>
                    <span className="badge badge-blue">Público</span>
                  </div>

                  {/* Title */}
                  <h3 className="mb-2 text-sm font-semibold leading-snug text-[#ccd8e0]">
                    {course.title}
                  </h3>

                  {/* Description */}
                  <p className="mb-3 flex-1 text-xs leading-relaxed text-[#4a6172] line-clamp-3">
                    {course.description}
                  </p>

                  {/* Footer */}
                  <div className="border-t border-[#192633] pt-3 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] text-[#273a47]">{courseAge(course.createdAt)}</p>
                      <p className="font-mono text-[9px] text-[#192633]">{fmtDate(course.createdAt)}</p>
                    </div>
                    <Link to={`/courses/${course.id}`} className="btn-cyan py-1 px-3 text-[10px]">
                      Acessar →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

    </Layout>
  )
}
