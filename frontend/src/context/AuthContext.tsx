import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import keycloak from '../lib/keycloak'
import api from '../lib/api'

interface User {
  id: string
  name: string
  email: string
  roles: string[]
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    // Sem onLoad: não tenta SSO silencioso. Processa callback do fragmento se presente,
    // caso contrário retorna false sem redirecionar — login explícito pelo usuário.
    keycloak
      .init({ checkLoginIframe: false })
      .then(async (authenticated) => {
        setIsAuthenticated(authenticated)
        if (authenticated) {
          try {
            const { data } = await api.get('/auth/me')
            setUser(data.user ?? data)
          } catch {
            // backend offline; mantém autenticado via Keycloak
          }
        }
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [])

  // Renova o token a cada 30s se estiver autenticado
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => {
      keycloak.updateToken(60).catch(() => keycloak.login())
    }, 30_000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  function login() {
    keycloak.login({ redirectUri: window.location.origin + '/dashboard' })
  }

  function logout() {
    keycloak.logout({ redirectUri: window.location.origin + '/login' })
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
