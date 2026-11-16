import { useRef, useState, type ChangeEvent } from 'react'
import { ImageUp, UserRound } from 'lucide-react'
import { uploadEmployeePhoto, type Employee } from '../lib/api'
import ProtectedPhoto from './ProtectedPhoto'

interface Props {
  token: string
  employee: Employee
  onUploaded: (employee: Employee) => void
}

// Same limits as the API
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

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

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please choose a JPEG or PNG photo.')
      return
    }

    if (file.size > MAX_SIZE) {
      setError('The photo is too large (max 5 MB).')
      return
    }

    setUploading(true)
    setError('')

    try {
      const updated = await uploadEmployeePhoto(token, employee.id, file)
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
          <small className="muted">JPEG or PNG, max 5 MB.</small>
          {error && <p className="field-error">{error}</p>}
        </div>
      </div>
    </section>
  )
}
