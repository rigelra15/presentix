import { useEffect, useState, type ReactNode } from 'react'
import {
  api,
  refreshAccessToken,
  SESSION_EXPIRED_EVENT,
  TOKEN_REFRESHED_EVENT,
  type LoginResponse,
  type SessionUser
} from '../lib/api'
import { AuthContext, type Session } from '../lib/auth-context'
import { Loading } from './ui'

// The access token (15 minutes) is kept only in memory, never in
// localStorage/sessionStorage. The refresh token is an httpOnly cookie
// that page scripts cannot read. After a page reload the session is
// restored by asking the server for a new access token.
async function loadUser(token: string): Promise<Session> {
  // /auth/me also returns employeeId for employee accounts
  const user = await api<SessionUser>('/api/employee/auth/me', { token })
  return { token, user }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [restoring, setRestoring] = useState(true)

  // On page load: still logged in from before?
  useEffect(() => {
    let ignore = false

    // Older versions kept the token in sessionStorage. Remove it.
    try {
      sessionStorage.removeItem('wfh-session')
    } catch {
      // Storage can be blocked. Nothing to clean up then.
    }

    refreshAccessToken()
      .then(token => (token ? loadUser(token) : null))
      .catch(() => null)
      .then(restored => {
        if (!ignore) {
          setSession(restored)
          setRestoring(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  async function login(email: string, password: string) {
    const result = await api<LoginResponse>('/api/employee/auth/login', {
      method: 'POST',
      body: { email, password }
    })

    const newSession = await loadUser(result.access_token)
    setSession(newSession)
    return newSession.user
  }

  async function logout() {
    // Ends the session on the server too, so the refresh cookie
    // cannot be used again even if it was copied.
    await fetch('/api/employee/auth/logout', { method: 'POST' }).catch(() => undefined)
    setSession(null)
  }

  useEffect(() => {
    // Keep the newest access token after a refresh
    function onRefreshed(event: Event) {
      const token = (event as CustomEvent<string>).detail
      setSession(current => (current ? { ...current, token } : current))
    }

    // Log out when the session cannot be renewed
    function onExpired() {
      setSession(null)
    }

    window.addEventListener(TOKEN_REFRESHED_EVENT, onRefreshed)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)

    return () => {
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onRefreshed)
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
    }
  }, [])

  if (restoring) {
    return <Loading text="Loading..." />
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
