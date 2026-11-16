import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { useSession } from '../lib/auth-context'
import { Alert, PageHeader } from '../components/ui'
import MyPhotoCard from '../components/MyPhotoCard'

// Same rules as the API (ChangePasswordDto)
function passwordProblem(password: string): string {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[a-z]/.test(password)) return 'Add a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Add an uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Add a number.'
  return ''
}

export default function AccountPage() {
  const { token, user } = useSession()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(false)

    const problem = passwordProblem(newPassword)
    if (problem) {
      setError(`New password: ${problem}`)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }

    setSaving(true)

    try {
      await api('/api/employee/auth/change-password', {
        token,
        method: 'POST',
        body: { currentPassword, newPassword }
      })

      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    } finally {
      setSaving(false)
    }
  }

  const inputType = showPasswords ? 'text' : 'password'

  return (
    <>
      <PageHeader title="Account" description={user.email} />

      {/* Only employees have a profile photo */}
      {user.role === 'EMPLOYEE' && <MyPhotoCard token={token} />}

      <form className="form-layout" onSubmit={handleSubmit}>
        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">Your password has been changed.</Alert>}

        {/* Lets password managers link the new password to this account */}
        <input type="email" value={user.email} autoComplete="username" readOnly hidden />

        <section className="card form-section-card">
          <div className="form-section-head">
            <h3>Change password</h3>
            <p>Other devices where you are logged in will be logged out.</p>
          </div>

          <div className="form-grid">
            <label className="field field-full">
              <span>Current password</span>
              <input
                type={inputType}
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <label className="field">
              <span>New password</span>
              <input
                type={inputType}
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                autoComplete="new-password"
                maxLength={128}
                required
              />
              <small className="muted">
                At least 8 characters, with uppercase, lowercase and a number.
              </small>
            </label>

            <label className="field">
              <span>Confirm new password</span>
              <input
                type={inputType}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                maxLength={128}
                required
              />
            </label>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowPasswords(value => !value)}
          >
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <KeyRound size={16} />
            {saving ? 'Saving...' : 'Change password'}
          </button>
        </div>
      </form>
    </>
  )
}
