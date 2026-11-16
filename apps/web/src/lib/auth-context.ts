import { createContext, useContext } from 'react'
import type { Role, SessionUser } from './api'

// First page after login for each role
export function homePathFor(role: Role): string {
  return role === 'HRD' ? '/hrd' : '/check-in'
}

export interface Session {
  token: string
  user: SessionUser
}

export interface AuthContextValue {
  session: Session | null
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }

  return value
}

// Shortcut for pages that are only shown to logged-in users
export function useSession(): Session {
  const { session } = useAuth()

  if (!session) {
    throw new Error('No active session')
  }

  return session
}
