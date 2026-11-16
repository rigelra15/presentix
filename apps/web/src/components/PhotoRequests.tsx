import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Check, UserRound, X } from 'lucide-react'
import { api, type Employee } from '../lib/api'
import { formatDateTime } from '../lib/format'
import ProtectedPhoto from './ProtectedPhoto'
import { Alert } from './ui'

interface Props {
  token: string
  // Called after a request was approved or rejected
  onReviewed: (employee: Employee, message: string) => void
}

// New profile photos sent by employees. HRD compares the current photo
// with the new one and approves or rejects it. Shows nothing when
// there are no requests.
export default function PhotoRequests({ token, onReviewed }: Props) {
  const [requests, setRequests] = useState<Employee[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<Employee[]>('/api/employee/employees/photo-requests', { token })
      .then(setRequests)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load photo requests'))
  }, [token])

  useEffect(load, [load])

  async function review(employee: Employee, decision: 'approve' | 'reject') {
    setBusyId(employee.id)
    setError('')

    try {
      const updated = await api<Employee>(
        `/api/employee/employees/${employee.id}/photo-request/${decision}`,
        // The time tells the API which photo HRD looked at
        { token, method: 'POST', body: { submittedAt: employee.photoRequestAt } }
      )
      setRequests(list => list.filter(item => item.id !== employee.id))
      onReviewed(
        updated,
        decision === 'approve'
          ? `The new photo of ${employee.fullName} is now their profile photo.`
          : `The photo of ${employee.fullName} was rejected. They can send another one.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the decision')
      // The employee may have sent a newer photo: show the latest data
      load()
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0 && !error) {
    return null
  }

  return (
    <section className="card photo-requests" id="photo-requests">
      <div className="card-header">
        <h3 className="card-title">
          Photo requests <span className="badge badge-warning">{requests.length}</span>
        </h3>
        <small className="muted">Approve only when both photos show the same person.</small>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="photo-request-list">
        {requests.map(employee => (
          <article key={`${employee.id}-${employee.photoRequestAt}`} className="photo-request">
            <div className="photo-request-head">
              <strong>{employee.fullName}</strong>
              <small className="muted">
                {employee.employeeCode} · {employee.department}
                {employee.photoRequestAt && ` · sent ${formatDateTime(employee.photoRequestAt)}`}
              </small>
            </div>

            <div className="photo-request-compare">
              <figure>
                {employee.hasPhoto ? (
                  <ProtectedPhoto
                    token={token}
                    path={`/api/employee/employees/${employee.id}/photo`}
                    alt={`Current photo of ${employee.fullName}`}
                  />
                ) : (
                  <div className="photo-box photo-empty">
                    <UserRound size={24} />
                    <span>No photo yet</span>
                  </div>
                )}
                <figcaption>Current</figcaption>
              </figure>
              <ArrowRight size={20} className="photo-request-arrow" aria-hidden="true" />
              <figure>
                <ProtectedPhoto
                  token={token}
                  path={`/api/employee/employees/${employee.id}/photo-request`}
                  alt={`New photo of ${employee.fullName}`}
                />
                <figcaption>New</figcaption>
              </figure>
            </div>

            <div className="photo-request-actions">
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={() => review(employee, 'reject')}
                disabled={busyId !== null}
              >
                <X size={14} />
                Reject
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => review(employee, 'approve')}
                disabled={busyId !== null}
              >
                <Check size={14} />
                {busyId === employee.id ? 'Saving...' : 'Approve'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
