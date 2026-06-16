import { type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Feature icons ────────────────────────────────────────────────

function IconShield() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.4}>
      <path d="M10 2L4 5v5c0 4 2.7 7.3 6 8.5 3.3-1.2 6-4.5 6-8.5V5l-6-3z" />
      <polyline points="7.5,10.5 9,12 12.5,8" />
    </svg>
  )
}

function IconKey() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.4}>
      <circle cx="7.5" cy="10" r="4" />
      <line x1="11.5" y1="10" x2="18" y2="10" />
      <line x1="15"   y1="7.5" x2="15" y2="12.5" />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.4}>
      <polyline points="2,12 5,5 8,14 11,9 14,12 17,7" />
    </svg>
  )
}

function IconDatabase() {
  return (
    <svg width="15" height="15" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.4}>
      <ellipse cx="10" cy="5" rx="7" ry="2.5" />
      <path d="M3 5v10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5" />
      <path d="M3 10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth={1.4}>
      <rect x="4" y="9" width="12" height="9" rx="2" />
      <path d="M7 9V7a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

// ── Feature list ─────────────────────────────────────────────────

interface Feature {
  icon: ReactNode
  label: string
  desc: string
  cyan?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: <IconShield />,
    label: 'MFA / OTP ativo',
    desc: 'Segunda etapa de verificação obrigatória em todos os acessos',
  },
  {
    icon: <IconKey />,
    label: 'Keycloak SSO',
    desc: 'Autenticação centralizada com identidade federada',
    cyan: true,
  },
  {
    icon: <IconActivity />,
    label: 'Acesso auditado',
    desc: 'Sessões registradas e monitoradas por política de segurança',
  },
  {
    icon: <IconDatabase />,
    label: 'Senhas protegidas',
    desc: 'Credenciais nunca armazenadas localmente no portal',
    cyan: true,
  },
]

// ── Main component ───────────────────────────────────────────────

export default function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth()

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-[#070b0e] flex flex-col items-center justify-center px-4 py-12">

      {/* Ambient grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,200,255,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,200,255,0.016) 1px, transparent 1px)
          `,
          backgroundSize: '56px 56px',
        }}
      />

      {/* Blobs */}
      <div className="pointer-events-none fixed top-[-8%] right-[-4%] w-[560px] h-[560px] rounded-full bg-[#39ff85] opacity-[0.028] blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-4%] w-[460px] h-[460px] rounded-full bg-[#00c8ff] opacity-[0.02] blur-[130px]" />
      {/* Left glow — enfatiza a área de identidade */}
      <div className="pointer-events-none fixed top-1/2 left-[5%] -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#39ff85] opacity-[0.012] blur-[150px]" />

      {/* Top accent */}
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-px bg-gradient-to-r from-[#39ff8544] via-[#00c8ff33] to-transparent" />

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="relative w-full max-w-5xl animate-fade-in">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20 lg:items-center">

          {/* ── LEFT: Identity hero ─────────────────────────────── */}
          <div className="order-2 lg:order-1">

            {/* Logo mark */}
            <div className="mb-8 flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#39ff8533] bg-[#39ff8509] shadow-[0_0_40px_#39ff8514]">
                <div className="h-6 w-6 rounded-md border border-[#39ff85] shadow-[0_0_14px_#39ff8566]" />
                {/* Corner accent */}
                <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon opacity-70" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-widest uppercase text-[#ccd8e0]">
                  Portal<span className="neon-text">.</span>AS
                </h1>
                <p className="text-[10px] tracking-[0.2em] uppercase text-[#273a47]">
                  Portal Acadêmico Seguro
                </p>
              </div>
            </div>

            {/* Tagline */}
            <p className="mb-7 text-base leading-relaxed text-[#4a6172]">
              Acesso seguro à sua jornada acadêmica.{' '}
              <span className="text-[#ccd8e0]">Autenticação forte, identidade protegida.</span>
            </p>

            {/* Separator */}
            <div className="mb-7 h-px bg-gradient-to-r from-[#39ff8530] to-transparent" />

            {/* Features */}
            <div className="flex flex-col gap-4">
              {FEATURES.map((f) => {
                const iconClasses = f.cyan
                  ? 'border-[#00c8ff22] bg-[#00c8ff08] text-[#00c8ff]'
                  : 'border-[#39ff8525] bg-[#39ff8508] text-[#39ff85]'

                return (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border ${iconClasses}`}>
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#ccd8e0]">{f.label}</p>
                      <p className="text-[10px] leading-snug text-[#4a6172]">{f.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Institutional note */}
            <p className="mt-8 text-[10px] leading-relaxed text-[#192633]">
              Acesso restrito a usuários cadastrados na instituição.
              Sessões monitoradas conforme política de segurança institucional.
            </p>
          </div>

          {/* ── RIGHT: Login card ───────────────────────────────── */}
          <div className="order-1 lg:order-2">
            <div className="panel-hud scan-line p-7">

              {/* Card header */}
              <div className="mb-6 flex items-center gap-3 border-b border-[#192633] pb-5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#39ff8530] bg-[#39ff8509] text-[#39ff85]">
                  <IconLock />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#ccd8e0]">Acesso ao sistema</h2>
                  <p className="text-[10px] text-[#4a6172]">Autenticação centralizada via Keycloak</p>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-col gap-4">
                <p className="text-xs text-[#4a6172] leading-relaxed">
                  Você será redirecionado ao servidor de autenticação institucional. Insira
                  suas credenciais e, se solicitado, confirme sua identidade com uma{' '}
                  <span className="text-[#ccd8e0]">segunda etapa de verificação</span> (OTP).
                </p>

                <div className="flex items-start gap-2 rounded border border-[#192633] bg-[#0b1117] px-3 py-2.5">
                  <span className="mt-0.5 cyan-text text-xs">▸</span>
                  <p className="text-[10px] text-[#4a6172] leading-relaxed">
                    O processo de autenticação é gerenciado integralmente pelo Keycloak.
                    O portal não armazena sua senha.
                  </p>
                </div>

                <button
                  onClick={login}
                  disabled={isLoading}
                  className="btn-primary mt-1 w-full text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verificando sessão...' : 'Entrar com Keycloak'}
                </button>
              </div>

              {/* Footer */}
              <div className="mt-5 border-t border-[#192633] pt-4 text-center">
                <Link
                  to="/courses"
                  className="text-xs text-[#4a6172] transition-colors hover:text-[#39ff85]"
                >
                  Ver cursos públicos sem login →
                </Link>
              </div>
            </div>

            {/* Status chips abaixo do card */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-[#39ff85] animate-pulse-neon" />
                <span className="text-[9px] text-[#273a47]">MFA ativo</span>
              </div>
              <div className="h-3 w-px bg-[#192633]" />
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-[#00c8ff] opacity-80" />
                <span className="text-[9px] text-[#273a47]">Ambiente seguro</span>
              </div>
              <div className="h-3 w-px bg-[#192633]" />
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-[#273a47]" />
                <span className="text-[9px] text-[#273a47]">Acesso monitorado</span>
              </div>
            </div>
          </div>

        </div>

        {/* Page footer */}
        <p className="mt-12 text-center text-[9px] uppercase tracking-[0.2em] text-[#192633]">
          Portal Acadêmico Seguro · Acesso restrito · Ambiente institucional
        </p>
      </div>
    </div>
  )
}
