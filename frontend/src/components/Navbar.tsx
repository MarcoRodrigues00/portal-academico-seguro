import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const TOP_LINKS = [
  { to: '/courses',   label: 'Cursos'         },
  { to: '/dashboard', label: 'Dashboard'      },
  { to: '/requests',  label: 'Requerimentos'  },
]

const ACADEMIC_LINKS = [
  { to: '/subjects',   label: 'Disciplinas' },
  { to: '/grades',     label: 'Notas'       },
  { to: '/contents',   label: 'Conteúdos'   },
  { to: '/attendance', label: 'Presença'    },
]

const ACADEMIC_PATHS = new Set(ACADEMIC_LINKS.map((l) => l.to))

function UserChip({ name }: { name: string }) {
  const parts = name.trim().split(' ')
  const initials =
    parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`
      : name.slice(0, 2)

  return (
    <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#192633] bg-[#0b1117] px-2.5 py-1">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#39ff8514] border border-[#39ff8530] text-[8px] font-bold text-[#39ff85] uppercase">
        {initials.toUpperCase()}
      </span>
      <span className="max-w-[110px] truncate text-xs text-[#4a6172]">{name}</span>
      <div className="h-1.5 w-1.5 rounded-full bg-[#39ff85] animate-pulse-neon" />
    </div>
  )
}

export default function Navbar() {
  const { pathname } = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const [academicOpen, setAcademicOpen] = useState(false)

  // Close dropdown on route change
  useEffect(() => {
    setAcademicOpen(false)
  }, [pathname])

  const displayName   = user?.name ?? user?.email ?? 'Usuário'
  const isAcademicActive = ACADEMIC_PATHS.has(pathname)

  return (
    <header className="sticky top-0 z-50 border-b border-[#192633] bg-[#070b0e]/96 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="relative flex h-7 w-7 items-center justify-center rounded-md border border-[#39ff8530] bg-[#39ff8508] transition-all group-hover:border-[#39ff8558] group-hover:bg-[#39ff8512]">
            <div className="h-3 w-3 rounded-sm border border-[#39ff85] transition-shadow group-hover:shadow-[0_0_10px_#39ff85]" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-bold tracking-widest uppercase text-[#ccd8e0] transition-colors group-hover:text-[#39ff85]">
              Portal<span className="text-[#39ff85]">.</span>AS
            </span>
            <span className="text-[8px] tracking-[0.2em] text-[#273a47] uppercase">
              Portal Acadêmico Seguro
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center">
          {TOP_LINKS.map(({ to, label }) => {
            const active = pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`relative px-4 py-2.5 text-xs font-medium tracking-wide uppercase transition-colors ${
                  active ? 'text-[#39ff85]' : 'text-[#4a6172] hover:text-[#c8d8e0]'
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-[#39ff85] to-transparent" />
                )}
              </Link>
            )
          })}

          {/* Acadêmico dropdown — only when authenticated */}
          {isAuthenticated && (
            <div className="relative">
              <button
                onClick={() => setAcademicOpen((v) => !v)}
                className={`relative flex items-center gap-1 px-4 py-2.5 text-xs font-medium tracking-wide uppercase transition-colors ${
                  isAcademicActive ? 'text-[#39ff85]' : 'text-[#4a6172] hover:text-[#c8d8e0]'
                }`}
              >
                Acadêmico
                <span className="text-[8px] transition-transform" style={{ transform: academicOpen ? 'scaleY(-1)' : 'none' }}>
                  ▾
                </span>
                {isAcademicActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-[#39ff85] to-transparent" />
                )}
              </button>

              {academicOpen && (
                <div className="absolute left-0 top-full mt-1 w-40 overflow-hidden rounded-md border border-[#192633] bg-[#0b1117] shadow-2xl animate-fade-in">
                  {ACADEMIC_LINKS.map(({ to, label }) => {
                    const active = pathname === to
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs transition-colors ${
                          active
                            ? 'bg-[#39ff8508] text-[#39ff85]'
                            : 'text-[#4a6172] hover:bg-[#0f1820] hover:text-[#ccd8e0]'
                        }`}
                      >
                        {active && <span className="h-1 w-1 rounded-full bg-[#39ff85]" />}
                        {label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-3">
          {isAuthenticated && <UserChip name={displayName} />}
          {isAuthenticated ? (
            <button onClick={logout} className="btn-ghost text-xs py-1 px-3">
              Sair
            </button>
          ) : (
            <Link to="/login" className="btn-ghost text-xs py-1 px-3">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
