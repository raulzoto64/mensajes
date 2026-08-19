import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { getSession, saveSession, clearSession, type SessionUser } from '../lib/auth'

type AuthCtx = {
  user: SessionUser | null
  setUser: (u: SessionUser | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(() => getSession())

  const setUser = useCallback((u: SessionUser | null) => {
    setUserState(u)
    if (u) saveSession(u)
    else clearSession()
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUserState(null)
  }, [])

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
