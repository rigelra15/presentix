import { useRef, useState, type ChangeEvent } from 'react'
import { Clock3, ImageUp, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { checkPhotoFile, uploadPhoto, type Employee } from '../lib/api'
import ProtectedPhoto from './ProtectedPhoto'

interface Props {
  token: string
  employee: Employee
  onUploaded: (employee: Employee) => void
}

// Profile photo of an employee. HRD compares it with the check-in
// photos to see that the right person checked in.
export default function EmployeePhotoCard({ token, employee, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  // Changes after every upload so the new photo is loaded
  const [version, setVersion] = useState(0)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const problem = checkPhotoFile(file)
    if (problem) {
      setError(problem)
      return
    }

    setUploading(true)
    setError('')

    try {
      const updated = await uploadPhoto(token, `/api/employee/employees/${employee.id}/photo`, file)
      setVersion(value => value + 1)
      onUploaded(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload the photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="card form-section-card">
      <div className="form-section-head">
        <h3>Profile photo</h3>
        <p>A clear photo of the face. HRD compares it with the check-in photos.</p>
      </div>

      <div className="profile-photo-row">
        <div className="profile-photo">
          {employee.hasPhoto ? (
            <ProtectedPhoto
              key={version}
              token={token}
              path={`/api/employee/employees/${employee.id}/photo`}
              alt={`Profile photo of ${employee.fullName}`}
            />
          ) : (
            <div className="photo-box photo-empty">
              <UserRound size={28} />
              <span>No photo yet</span>
            </div>
          )}
        </div>

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
            disabled={uploading}
          >
            <ImageUp size={16} />
            {uploading ? 'Uploading...' : employee.hasPhoto ? 'Replace photo' : 'Upload photo'}
          </button>
          <small className="muted">JPEG or PNG, max 5 MB. Uploaded by HRD, so no approval is needed.</small>
          {employee.photoRequestAt && (
            <p className="photo-request-note">
              <Clock3 size={14} />
              <span>
                This employee sent a new photo.{' '}
                <Link to="/hrd/employees">Review it on the Employees page</Link>.
              </span>
            </p>
          )}
          {error && <p className="field-error">{error}</p>}
        </div>
      </div>
    </section>
  )
}
