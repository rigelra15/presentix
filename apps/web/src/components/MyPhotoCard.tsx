import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Clock3, ImageUp, UserRound, X } from 'lucide-react'
import { api, checkPhotoFile, uploadPhoto, type Employee } from '../lib/api'
import { formatDateTime } from '../lib/format'
import ProtectedPhoto from './ProtectedPhoto'
import { Alert } from './ui'

// The employee's own profile photo (Account page).
// A new photo is only a request: it replaces the current photo after
// HRD approves it, so nobody can put another person's face on an account.
export default function MyPhotoCard({ token }: { token: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<Employee | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Changes after every upload so the new request photo is loaded
  const [version, setVersion] = useState(0)

  useEffect(() => {
    api<Employee>('/api/employee/me/profile', { token })
      .then(setProfile)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load your profile'))
  }, [token])

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const problem = checkPhotoFile(file)
    if (problem) {
      setError(problem)
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      setProfile(await uploadPhoto(token, '/api/employee/me/photo-request', file))
      setVersion(value => value + 1)
      setNotice('Your new photo was sent. It will be used after HR approves it.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the photo')
    } finally {
      setBusy(false)
    }
  }

  async function cancelRequest() {
    setBusy(true)
    setError('')
    setNotice('')

    try {
      setProfile(await api<Employee>('/api/employee/me/photo-request', { token, method: 'DELETE' }))
      setNotice('Your photo request was cancelled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel the request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card form-section-card">
      <div className="form-section-head">
        <h3>Profile photo</h3>
        <p>HR compares it with your check-in photos. A new photo needs HR approval.</p>
      </div>

      <div>
        {error && <Alert type="error">{error}</Alert>}
        {notice && <Alert type="success">{notice}</Alert>}
        {profile?.photoRejectedAt && !profile.photoRequestAt && (
          <Alert type="error">
            HR did not approve the photo you sent on {formatDateTime(profile.photoRejectedAt)}. Please
            send a clear photo of your face.
          </Alert>
        )}

        {profile && (
          <div className="profile-photo-row">
            <figure className="profile-photo">
              {profile.hasPhoto ? (
                <ProtectedPhoto token={token} path="/api/employee/me/photo" alt="Your profile photo" />
              ) : (
                <div className="photo-box photo-empty">
                  <UserRound size={28} />
                  <span>No photo yet</span>
                </div>
              )}
              <figcaption>Current photo</figcaption>
            </figure>

            {profile.photoRequestAt && (
              <figure className="profile-photo">
                <ProtectedPhoto
                  key={version}
                  token={token}
                  path="/api/employee/me/photo-request"
                  alt="Your new photo, waiting for approval"
                />
                <figcaption>
                  <span className="badge badge-warning">
                    <Clock3 size={12} />
                    Waiting for HR
                  </span>
                </figcaption>
              </figure>
            )}

            <div className="profile-photo-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFile}
                hidden
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <ImageUp size={16} />
                {busy ? 'Please wait...' : profile.photoRequestAt ? 'Send another photo' : 'Send new photo'}
              </button>
              {profile.photoRequestAt && (
                <button type="button" className="btn btn-ghost" onClick={cancelRequest} disabled={busy}>
                  <X size={16} />
                  Cancel request
                </button>
              )}
              <small className="muted">JPEG or PNG, max 5 MB.</small>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
