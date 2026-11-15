import { useEffect, useState, type ReactNode } from 'react'
import {
  api,
  SESSION_EXPIRED_EVENT,
  type LoginResponse,
  type SessionUser
} from '../lib/api'
import { AuthContext, type Session } from '../lib/auth-context'

// sessionStorage keeps the user logged in after a page refresh,
// but the session is cleared when the browser tab is closed.
const STORAGE_KEY = 'wfh-session'

function loadSession(): Session | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Session) : null
  } catch {
    return null
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession)

  function saveSession(value: Session | null) {
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }

    setSession(value)
  }

  async function login(email: string, password: string) {
    const result = await api<LoginResponse>('/api/employee/auth/login', {
      method: 'POST',
      body: { email, password }
    })

    // /auth/me also returns employeeId for employee accounts
    const user = await api<SessionUser>('/api/employee/auth/me', {
      token: result.access_token
    })

    saveSession({ token: result.access_token, user })
    return user
  }

  function logout() {
    saveSession(null)
  }

  // Log out automatically when any request gets HTTP 401
  useEffect(() => {
    function onExpired() {
      sessionStorage.removeItem(STORAGE_KEY)
      setSession(null)
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
