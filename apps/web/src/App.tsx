import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  api,
  uploadAttendance,
  type Attendance,
  type LoginResponse,
  type SessionUser,
} from './lib/api';
import './App.css';

import HrdDashboard from './components/HrdDashboard';

interface Session {
  token: string
  user: SessionUser
}

function getWibToday(): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })

  const parts = formatter.formatToParts(new Date())

  const getPart = (type: string) =>
    parts.find(part => part.type === type)?.value ?? ''

  return [
    getPart('year'),
    getPart('month'),
    getPart('day')
  ].join('-')
}


function EmployeeDashboard({ token }: { token: string }) {
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true

    api<Attendance[]>('/api/attendance/attendances/me', {
      token
    })
      .then(data => {
        if (active) setRecords(data)
      })
      .catch(error => {
        if (active) {
          setHistoryError(
            error instanceof Error
              ? error.message
              : 'Failed to load attendance'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const today = getWibToday()

  const checkedInToday = records.some(
    record => record.attendanceDate === today
  )

  function handlePhotoChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setFeedback(null)

    const selected = event.target.files?.[0] ?? null

    if (!selected) {
      setPhoto(null)
      setPreviewUrl(null)
      return
    }

    if (
      selected.type !== 'image/jpeg' &&
      selected.type !== 'image/png'
    ) {
      setFeedback({
        type: 'error',
        message: 'Only JPEG and PNG photos are allowed.'
      })

      setPhoto(null)
      setPreviewUrl(null)
      event.target.value = ''
      return
    }

    if (selected.size === 0 || selected.size > 5 * 1024 * 1024) {
      setFeedback({
        type: 'error',
        message: 'Photo must be larger than 0 bytes and at most 5 MB.'
      })

      setPhoto(null)
      setPreviewUrl(null)
      event.target.value = ''
      return
    }

    setPhoto(selected)
    setPreviewUrl(URL.createObjectURL(selected))
  }

  async function handleCheckIn(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    if (
      !photo ||
      submitting ||
      checkedInToday ||
      loading ||
      historyError
    ) {
      return
    }

    setSubmitting(true)
    setFeedback(null)

    let uploadSucceeded = false

    try {
      await uploadAttendance(token, photo)
      uploadSucceeded = true

      setFeedback({
        type: 'success',
        message: 'WFH check-in submitted successfully!'
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error
          ? error.message
          : 'Check-in failed'
      })
    }

    // Refresh even when POST returns an unexpected response.
    // The attendance may already have been saved in MySQL.
    try {
      const updatedRecords = await api<Attendance[]>(
        '/api/attendance/attendances/me',
        { token }
      )

      setRecords(updatedRecords)
      setHistoryError('')

      const recordedToday = updatedRecords.some(
        record => record.attendanceDate === getWibToday()
      )

      if (recordedToday) {
        setFeedback({
          type: 'success',
          message: uploadSucceeded
            ? 'Check-in successful! Your attendance has been recorded.'
            : 'Today’s attendance is already recorded. Check your history below.'
        })

        setPhoto(null)
        setPreviewUrl(null)

        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch {
      setHistoryError(
        'Unable to refresh attendance. Reload the page before submitting again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="checkin-card">
        <div className="section-heading">
          <h2>WFH Check-in</h2>
          <p>
            Submit your work-from-home photo to record
            today's attendance.
          </p>
        </div>

        <div className="checkin-date">
          <span>Attendance date (WIB)</span>
          <strong>{today}</strong>
        </div>

        {checkedInToday ? (
          <div className="checkin-complete" role="status">
            <strong>✓ You've checked in today</strong>
            <p>
              Your attendance is recorded.
              You can check in again tomorrow.
            </p>
          </div>
        ) : (
          <form
            className="checkin-form"
            onSubmit={handleCheckIn}
          >
            <label htmlFor="wfh-photo">
              WFH Photo
            </label>

            <input
              ref={fileInputRef}
              id="wfh-photo"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handlePhotoChange}
              disabled={submitting || loading}
              required
            />

            <p className="file-hint">
              JPEG or PNG · Maximum 5 MB
            </p>

            {previewUrl && (
              <div className="photo-preview">
                <img
                  src={previewUrl}
                  alt="Preview of your selected WFH photo"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={
                !photo ||
                submitting ||
                loading ||
                Boolean(historyError)
              }
            >
              {submitting
                ? 'Submitting check-in...'
                : 'Check In Now'}
            </button>
          </form>
        )}

        {feedback && (
          <p
            className={
              feedback.type === 'success'
                ? 'feedback-success'
                : 'error'
            }
            role={feedback.type === 'error' ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        )}
      </section>

      <section className="attendance-history">
        <div className="section-heading">
          <h2>My Attendance</h2>
          <p>Your WFH check-in history.</p>
        </div>

        {loading && <p>Loading attendance...</p>}

        {historyError && (
          <p className="error" role="alert">
            {historyError}
          </p>
        )}

        {!loading && !historyError && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check-in Time</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {records.map(record => (
                  <tr key={record.id}>
                    <td>{record.attendanceDate}</td>

                    <td>
                      {new Intl.DateTimeFormat('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(
                        new Date(record.checkedInAt)
                      )}{' WIB'}
                    </td>

                    <td>
                      <span className="status active">
                        Checked in
                      </span>
                    </td>
                  </tr>
                ))}

                {records.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      No attendance recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const login = await api<LoginResponse>(
        '/api/employee/auth/login',
        {
          method: 'POST',
          body: { email, password }
        }
      )

      const user = await api<SessionUser>(
        '/api/employee/auth/me',
        { token: login.access_token }
      )

      setSession({
        token: login.access_token,
        user
      })
      setPassword('')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Login failed'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!session) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <div className="brand">WFH Attendance</div>
          <h1>Welcome back</h1>
          <p>Sign in to your employee account.</p>

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />

          {error && <p className="error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <div className="brand">WFH Attendance</div>
          <small>{session.user.role} Workspace</small>
        </div>

        <div className="account">
          <span>{session.user.email}</span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSession(null)}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h1>
          {session.user.role === 'HRD'
            ? 'HRD Dashboard'
            : 'Employee Dashboard'}
        </h1>

        {session.user.role === 'HRD'
          ? <HrdDashboard token={session.token} />
          : <EmployeeDashboard token={session.token} />}
      </main>
    </div>
  )
}
