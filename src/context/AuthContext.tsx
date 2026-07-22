import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function signIn(email: string, password: string) {
    try {
      const result = await api.post<AuthUser>('/api/auth/login', { email, password })
      setUser(result)
      return { error: null }
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Failed to sign in' }
    }
  }

  async function signUp(email: string, password: string) {
    try {
      const result = await api.post<AuthUser>('/api/auth/signup', { email, password })
      setUser(result)
      return { error: null }
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Failed to sign up' }
    }
  }

  async function signOut() {
    await api.post('/api/auth/logout')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
