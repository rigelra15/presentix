import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Camera, LogIn, MapPin, ShieldCheck } from 'lucide-react'
import { homePathFor, useAuth } from '../lib/auth-context'
import { Alert } from '../components/ui'
import BrandMark from '../components/BrandMark'
import { APP_NAME, EMAIL_DOMAIN } from '../lib/brand'

export default function LoginPage() {
  const { session, login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already logged in -> go straight to the dashboard
  if (session) {
    return <Navigate to={homePathFor(session.user.role)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(email.trim(), password)
      navigate(homePathFor(user.role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-hero-brand">
          <BrandMark />
          <strong>{APP_NAME}</strong>
        </div>

        <div>
          <h2>Work from anywhere, check in with confidence.</h2>
          <p>Daily work-from-home attendance with a live photo and GPS location.</p>

          <ul className="login-features">
            <li><Camera size={18} /> Live camera photo as proof of work</li>
            <li><MapPin size={18} /> GPS location recorded on every check-in</li>
            <li><ShieldCheck size={18} /> HRD monitors attendance in real time</li>
          </ul>
        </div>

        <small>Server time is used for every check-in (WIB).</small>
      </section>

      <section className="login-form-side">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Sign in</h1>
          <p className="muted">Use the account given by your HR department.</p>

          {error && <Alert type="error">{error}</Alert>}

          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder={`name@${EMAIL_DOMAIN}`}
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            <LogIn size={18} />
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </div>
  )
}
