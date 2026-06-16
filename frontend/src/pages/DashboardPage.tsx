import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import keycloak from '../lib/keycloak'

interface Request {
  id: string | number
  title: string
  status: string
  createdAt: string
}

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'badge-yellow',
  APPROVED:  'badge-green',
  COMPLETED: 'badge-blue',
  REJECTED:  'badge-red',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'Em análise',
  APPROVED:  'Aprovado',
  COMPLETED: 'Concluído',
  REJECTED:  'Reprovado',
}

// Cor do dot da timeline por status
const STATUS_DOT: Record<string, string> = {
  PENDING:   'border-[#f0c040]  bg-[#f0c04022]',
  APPROVED:  'border-[#39ff85]  bg-[#39ff8522]',
  COMPLETED: 'border-[#00c8ff]  bg-[#00c8ff22]',
  REJECTED:  'border-red-400    bg-red-400/10',
}

const SKIP_ROLES = new Set(['offline_access', 'uma_authorization'])

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `há ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia${days > 1 ? 's' : ''}`
}

function shortId(id: string | number) {
  const s = String(id)
  return s.length > 6 ? `#${s.slice(-4).toUpperCase()}` : `#${s}`
}

function userInitials(name: string): string {
  const parts = name.trim().split(' ')
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2)
}

function fmtTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ──────────────────────────────────────────────

function IconDocument({ color = '#39ff85' }: { color?: string }) {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20" stroke={color} strokeWidth={1.4}>
      <rect x="4" y="2" width="12" height="16" rx="2" />
      <line x1="7" y1="7"  x2="13" y2="7"  />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="10" y2="13" />
    </svg>
  )
}

function IconGrid({ color = '#00c8ff' }: { color?: string }) {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20" stroke={color} strokeWidth={1.4}>
      <rect x="3"  y="3"  width="6" height="6" rx="1" />
      <rect x="11" y="3"  width="6" height="6" rx="1" />
      <rect x="3"  y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  )
}

function IconLock({ color = '#273a47' }: { color?: string }) {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 20 20" stroke={color} strokeWidth={1.4}>
      <rect x="4" y="9" width="12" height="9" rx="2" />
      <path d="M7 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  )
}

function SecurityRow({
  label,
  value,
  accent = false,
  cyan = false,
}: {
  label: string
  value: string
  accent?: boolean
  cyan?: boolean
}) {
  const valueColor = accent ? 'text-[#39ff85]' : cyan ? 'text-[#00c8ff]' : 'text-[#ccd8e0]'
  return (
    <div className="flex items-center justify-between border-b border-[#192633] py-1.5 last:border-0">
      <span className="text-[10px] text-[#4a6172]">{label}</span>
      <span className={`font-mono text-[10px] ${valueColor}`}>{value}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth()
  const firstName = user?.name?.split(' ')[0] ?? 'Usuário'

  // Dados reais extraídos do token Keycloak
  const tokenParsed       = keycloak.tokenParsed as Record<string, unknown> | undefined
  const authTimestamp     = typeof tokenParsed?.auth_time          === 'number' ? tokenParsed.auth_time          : null
  const expTimestamp      = typeof tokenParsed?.exp                === 'number' ? tokenParsed.exp                : null
  const preferredUsername = typeof tokenParsed?.preferred_username === 'string' ? tokenParsed.preferred_username : null
  const clientId          = typeof tokenParsed?.azp                === 'string' ? tokenParsed.azp                : null

  const sessionStart      = authTimestamp ? fmtTime(new Date(authTimestamp * 1000)) : null
  const sessionDate       = authTimestamp ? new Date(authTimestamp * 1000).toLocaleDateString('pt-BR') : null
  const tokenExpiresAt    = expTimestamp  ? fmtTime(new Date(expTimestamp  * 1000)) : null
  const sessionDurationMins = authTimestamp
    ? Math.floor((Date.now() - authTimestamp * 1000) / 60_000)
    : null

  const meaningfulRoles = (user?.roles ?? [])
    .filter((r) => !SKIP_ROLES.has(r) && !r.startsWith('default-roles-'))

  // API data
  const [requests, setRequests]       = useState<Request[]>([])
  const [courseCount, setCourseCount] = useState<number | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [apiStatus, setApiStatus]     = useState<'loading' | 'ok' | 'error'>('loading')
  const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<{ requests: Request[] }>('/requests/me'),
      api.get<{ courses: unknown[] }>('/courses/public'),
    ])
      .then(([reqRes, courseRes]) => {
        setRequests(reqRes.data.requests)
        setCourseCount(courseRes.data.courses.length)
      })
      .catch(() => setError('Erro ao carregar dados do painel.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const healthUrl = `${import.meta.env.VITE_API_URL}/health`
    fetch(healthUrl)
      .then((res) => {
        setApiStatus(res.ok ? 'ok' : 'error')
        setHealthCheckedAt(fmtTime(new Date()))
      })
      .catch(() => {
        setApiStatus('error')
        setHealthCheckedAt(fmtTime(new Date()))
      })
  }, [])

  // Métricas derivadas dos requests (dados reais)
  const pendingCount  = requests.filter((r) => r.status === 'PENDING').length
  const approvedCount = requests.filter((r) => r.status === 'APPROVED' || r.status === 'COMPLETED').length
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length

  const recentActivity = [...requests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  // Delta textual para o card de requerimentos
  const requestsDelta = (() => {
    if (loading || requests.length === 0) return loading ? '' : 'nenhum enviado'
    const parts: string[] = []
    if (pendingCount  > 0) parts.push(`${pendingCount} em análise`)
    if (approvedCount > 0) parts.push(`${approvedCount} aprovado${approvedCount > 1 ? 's' : ''}`)
    if (rejectedCount > 0) parts.push(`${rejectedCount} reprovado${rejectedCount > 1 ? 's' : ''}`)
    return parts.join(' · ') || 'sem pendências'
  })()

  const stats = [
    {
      label:   'Requerimentos',
      value:   loading ? '—' : String(requests.length),
      delta:   requestsDelta,
      variant: 'stat-card',
    },
    {
      label:   'Aprovados',
      value:   loading ? '—' : String(approvedCount),
      delta:   loading ? '' : requests.length > 0 ? `de ${requests.length} enviados` : 'nenhum enviado',
      variant: 'stat-card',
    },
    {
      label:   'Cursos',
      value:   loading ? '—' : String(courseCount ?? '—'),
      delta:   'No catálogo público',
      variant: 'stat-card-alt',
    },
    {
      label:   'Certificados',
      value:   '—',
      delta:   'Em breve',
      variant: 'stat-card-alt',
    },
  ]

  return (
    <Layout>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="section-label mb-2">Área restrita</p>
          <h1 className="text-2xl font-bold text-[#ccd8e0]">
            Olá, <span className="neon-text">{firstName}</span>
          </h1>
          <p className="mt-1 text-sm text-[#4a6172]">
            {sessionDate && sessionStart
              ? `Sessão iniciada em ${sessionDate} às ${sessionStart}`
              : 'Bem-vindo ao seu painel acadêmico.'}
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 rounded-md border border-[#192633] bg-[#0b1117] px-3 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
            <span className="text-xs text-[#4a6172]">Sistema online</span>
          </div>
          {sessionDurationMins !== null && (
            <span className="font-mono text-[9px] text-[#273a47]">
              sessão há {sessionDurationMins < 60
                ? `${sessionDurationMins}min`
                : `${Math.floor(sessionDurationMins / 60)}h${sessionDurationMins % 60}min`}
            </span>
          )}
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`${stat.variant} p-5 animate-fade-in`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#4a6172]">
              {stat.label}
            </p>
            <p className="mt-3 font-mono text-3xl font-bold neon-text">{stat.value}</p>

            {/* Mini breakdown bar — apenas para Requerimentos com dados reais */}
            {stat.label === 'Requerimentos' && !loading && requests.length > 0 && (
              <div className="mt-2 flex h-1 gap-0.5 overflow-hidden rounded-full">
                {pendingCount  > 0 && <div style={{ width: `${(pendingCount  / requests.length) * 100}%` }} className="bg-[#f0c040]" />}
                {approvedCount > 0 && <div style={{ width: `${(approvedCount / requests.length) * 100}%` }} className="bg-[#39ff85]" />}
                {rejectedCount > 0 && <div style={{ width: `${(rejectedCount / requests.length) * 100}%` }} className="bg-red-400"    />}
              </div>
            )}

            <div className="my-2 h-px bg-[#192633]" />
            <p className="text-[10px] text-[#273a47]">{stat.delta}</p>
          </div>
        ))}
      </div>

      {/* ── Main content grid ─────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Activity timeline — 2/3 */}
        <div className="panel-hud p-5 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#ccd8e0]">Atividade recente</h2>
            <Link to="/requests" className="tag hover:border-[#39ff8544] hover:text-[#39ff85] transition-colors">
              Ver todos →
            </Link>
          </div>

          {loading && (
            <div className="flex flex-col gap-4 py-2">
              {[1, 2, 3].map((k) => (
                <div key={k} className="flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="skeleton h-3 w-44" />
                    <div className="skeleton h-2.5 w-24" />
                  </div>
                  <div className="skeleton h-4 w-20 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="py-4 text-xs text-red-400">{error}</p>
          )}

          {!loading && !error && recentActivity.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <svg className="w-10 h-10 text-[#192633]" fill="none" viewBox="0 0 40 40" stroke="currentColor" strokeWidth={1.2}>
                <rect x="6" y="4" width="28" height="32" rx="2.5" />
                <line x1="12" y1="13" x2="28" y2="13" />
                <line x1="12" y1="19" x2="28" y2="19" />
                <line x1="12" y1="25" x2="20" y2="25" />
              </svg>
              <div>
                <p className="text-xs font-medium text-[#273a47]">Nenhuma atividade ainda</p>
                <p className="mt-1 text-[10px] text-[#192633]">Seus requerimentos aparecerão aqui.</p>
              </div>
              <Link to="/requests" className="btn-ghost py-1.5 px-4 text-xs">
                Abrir primeiro requerimento
              </Link>
            </div>
          )}

          {!loading && !error && recentActivity.length > 0 && (
            <div className="relative border-l border-[#192633] pl-5">
              {recentActivity.map((req, i) => (
                <div
                  key={req.id}
                  className="relative mb-5 last:mb-0 animate-fade-in"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  {/* Dot colorido por status */}
                  <div className={`absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full border ${STATUS_DOT[req.status] ?? STATUS_DOT.PENDING}`} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-[#ccd8e0]">
                        <span className="font-mono text-[#39ff85]">{shortId(req.id)}</span>
                        {' — '}
                        {req.title}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[#273a47]">{relativeTime(req.createdAt)}</p>
                    </div>
                    <span className={`badge shrink-0 ${STATUS_BADGE[req.status] ?? 'badge-yellow'}`}>
                      {STATUS_LABEL[req.status] ?? req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column — 1/3 */}
        <div className="flex flex-col gap-4">

          {/* User profile card */}
          <div className="panel p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#39ff8530] bg-[#39ff8509] text-sm font-bold text-[#39ff85] uppercase">
                  {userInitials(user?.name ?? 'U')}
                </div>
                {/* Status online dot */}
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1117] bg-[#39ff85]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#ccd8e0]">
                  {user?.name ?? 'Usuário'}
                </p>
                {preferredUsername && preferredUsername !== user?.name && (
                  <p className="font-mono text-[10px] text-[#39ff85]">@{preferredUsername}</p>
                )}
                <p className="truncate text-[10px] text-[#4a6172]">{user?.email ?? '—'}</p>
              </div>
            </div>

            {/* Session duration pill */}
            {sessionDurationMins !== null && (
              <div className="mb-3 flex items-center gap-1.5 rounded border border-[#192633] bg-[#0b1117] px-2.5 py-1.5">
                <div className="h-1 w-1 rounded-full bg-[#39ff85] animate-pulse-neon" />
                <span className="text-[10px] text-[#4a6172]">
                  Sessão ativa há{' '}
                  <span className="font-mono text-[#ccd8e0]">
                    {sessionDurationMins < 60
                      ? `${sessionDurationMins}min`
                      : `${Math.floor(sessionDurationMins / 60)}h${sessionDurationMins % 60}min`}
                  </span>
                </span>
              </div>
            )}

            {/* Roles */}
            {meaningfulRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 border-t border-[#192633] pt-3">
                {meaningfulRoles.slice(0, 4).map((role) => (
                  <span key={role} className="tag">{role}</span>
                ))}
              </div>
            )}
          </div>

          {/* Security card */}
          <div className="panel-hud panel-hud-cyan p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[#ccd8e0]">Segurança da conta</h3>
              <span className="badge badge-green">Protegida</span>
            </div>

            <SecurityRow label="MFA / OTP"          value="✓ Ativo"        accent />
            <SecurityRow label="Protocolo"           value="OIDC + PKCE"    cyan  />
            <SecurityRow label="Autenticador"        value="Keycloak SSO"         />
            {clientId    && <SecurityRow label="Cliente"             value={clientId}             />}
            {sessionStart && <SecurityRow label="Login às"            value={sessionStart}         />}
            {tokenExpiresAt && <SecurityRow label="Token expira às"   value={tokenExpiresAt}       />}
          </div>
        </div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────── */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">

        <Link to="/requests" className="card group flex items-center gap-3 p-4">
          <div className="shrink-0 rounded border border-[#39ff8525] bg-[#39ff8508] p-1.5 transition-colors group-hover:border-[#39ff8545] group-hover:bg-[#39ff8512]">
            <IconDocument />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[#ccd8e0] transition-colors group-hover:text-[#39ff85]">
                Novo requerimento
              </p>
              {!loading && pendingCount > 0 && (
                <span className="badge badge-yellow">{pendingCount}</span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-[#4a6172]">Documentos, trancamentos e mais</p>
          </div>
          <span className="shrink-0 text-xs text-[#273a47] transition-all group-hover:text-[#39ff85] group-hover:translate-x-0.5">→</span>
        </Link>

        <Link to="/courses" className="card group flex items-center gap-3 p-4">
          <div className="shrink-0 rounded border border-[#00c8ff22] bg-[#00c8ff08] p-1.5 transition-colors group-hover:border-[#00c8ff40] group-hover:bg-[#00c8ff12]">
            <IconGrid />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-[#ccd8e0] transition-colors group-hover:text-[#39ff85]">
                Explorar cursos
              </p>
              {!loading && courseCount !== null && courseCount > 0 && (
                <span className="badge badge-blue">{courseCount}</span>
              )}
            </div>
            <p className="mt-0.5 text-[10px] text-[#4a6172]">Catálogo de cursos preparatórios</p>
          </div>
          <span className="shrink-0 text-xs text-[#273a47] transition-all group-hover:text-[#39ff85] group-hover:translate-x-0.5">→</span>
        </Link>

        <div className="flex cursor-not-allowed items-center gap-3 rounded-md border border-[#192633] bg-[#0b1117] p-4 opacity-40">
          <div className="shrink-0 rounded border border-[#273a47] bg-[#0f1820] p-1.5">
            <IconLock />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#4a6172]">Emitir certificado</p>
            <p className="mt-0.5 text-[10px] text-[#273a47]">Em breve</p>
          </div>
        </div>
      </div>

      {/* ── Academic quick access ─────────────────────────────── */}
      {isAuthenticated && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/subjects',   label: 'Disciplinas',  note: 'Grade curricular'        },
            { to: '/grades',     label: 'Notas',         note: 'Boletim escolar'         },
            { to: '/attendance', label: 'Frequência',    note: 'Presença por disciplina' },
            { to: '/contents',   label: 'Materiais',     note: 'Conteúdos e arquivos'    },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="card group flex items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#ccd8e0] transition-colors group-hover:text-[#39ff85]">
                  {item.label}
                </p>
                <p className="text-[10px] text-[#4a6172]">{item.note}</p>
              </div>
              <span className="shrink-0 text-xs text-[#273a47] transition-all group-hover:text-[#39ff85] group-hover:translate-x-0.5">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* ── System status strip ───────────────────────────────── */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">

        <div className="panel px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-[#4a6172]">API Backend</span>
            <div className="flex items-center gap-1.5">
              {apiStatus === 'loading' && (
                <>
                  <div className="skeleton h-1.5 w-1.5 rounded-full" />
                  <span className="font-mono text-[10px] text-[#273a47]">verificando</span>
                </>
              )}
              {apiStatus === 'ok' && (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
                  <span className="font-mono text-[10px] text-[#39ff85]">Operacional</span>
                </>
              )}
              {apiStatus === 'error' && (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="font-mono text-[10px] text-red-400">Indisponível</span>
                </>
              )}
            </div>
          </div>
          {healthCheckedAt && (
            <p className="mt-1 font-mono text-[9px] text-[#192633]">verificado às {healthCheckedAt}</p>
          )}
        </div>

        <div className="panel flex items-center justify-between px-4 py-3">
          <span className="text-[10px] uppercase tracking-widest text-[#4a6172]">Keycloak SSO</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
            <span className="font-mono text-[10px] text-[#39ff85]">Operacional</span>
          </div>
        </div>

        <div className="panel flex items-center justify-between px-4 py-3">
          <span className="text-[10px] uppercase tracking-widest text-[#4a6172]">Ambiente</span>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#00c8ff] opacity-80" />
            <span className="font-mono text-[10px] text-[#00c8ff]">Seguro · TLS</span>
          </div>
        </div>
      </div>

    </Layout>
  )
}
