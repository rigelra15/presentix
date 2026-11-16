import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPinOff, UserRound } from 'lucide-react'
import { api, type Attendance, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatDuration, formatTime } from '../../lib/format'
import { Alert, Loading, PageHeader, StatusBadge } from '../../components/ui'
import LocationMap from '../../components/LazyLocationMap'
import ProtectedPhoto from '../../components/ProtectedPhoto'

// Used by HRD (/hrd/attendance/:id) and by employees for their own
// check-ins (/history/:id). The API only returns an employee's own records.
export default function AttendanceDetailPage() {
  const { token, user } = useSession()
  const { id } = useParams()
  const isHrd = user.role === 'HRD'
  const backTo = isHrd ? '/hrd/attendance' : '/history'

  const [record, setRecord] = useState<Attendance | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const attendance = await api<Attendance>(`/api/attendance/attendances/${id}`, { token })
        setRecord(attendance)

        // Only HRD can read employee data. This one can fail quietly.
        if (isHrd) {
          const owner = await api<Employee>(
            `/api/employee/employees/${attendance.employeeId}`,
            { token }
          ).catch(() => null)
          setEmployee(owner)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, token, isHrd])

  if (loading) {
    return <Loading />
  }

  const photoBase = `/api/attendance/attendances/${record?.id}`

  return (
    <>
      <Link to={backTo} className="back-link">
        <ArrowLeft size={16} />
        {isHrd ? 'Back to attendance' : 'Back to my history'}
      </Link>

      {error || !record ? (
        <Alert type="error">{error || 'Attendance not found'}</Alert>
      ) : (
        <>
          <PageHeader
            title={isHrd ? (employee?.fullName ?? `Employee #${record.employeeId}`) : 'My check-in'}
            description={`Check-in on ${formatDate(record.attendanceDate)}`}
          />

          <div className="detail-grid">
            <section className="card">
              <div className="card-title-row">
                <h3 className="card-title">Photos</h3>
                <FaceCheckBadge record={record} />
              </div>

              {isHrd ? (
                // HRD compares the profile photo with today's photo
                <div className="photo-compare">
                  <figure>
                    {employee?.hasPhoto ? (
                      <ProtectedPhoto
                        token={token}
                        path={`/api/employee/employees/${record.employeeId}/photo`}
                        alt="Profile photo"
                      />
                    ) : (
                      <div className="photo-box photo-empty">
                        <UserRound size={28} />
                        <span>No profile photo</span>
                      </div>
                    )}
                    <figcaption>Profile photo</figcaption>
                  </figure>
                  <figure>
                    <ProtectedPhoto
                      key={record.id}
                      token={token}
                      path={`${photoBase}/photo`}
                      alt="Check-in photo"
                    />
                    <figcaption>Check-in photo</figcaption>
                  </figure>
                </div>
              ) : (
                <ProtectedPhoto key={record.id} token={token} path={`${photoBase}/photo`} alt="Check-in photo" />
              )}

              {record.livenessChecked && (
                <div className="face-check-frames">
                  <figure>
                    <ProtectedPhoto token={token} path={`${photoBase}/liveness/left`} alt="Head turned left" />
                    <figcaption>Turned left</figcaption>
                  </figure>
                  <figure>
                    <ProtectedPhoto token={token} path={`${photoBase}/liveness/right`} alt="Head turned right" />
                    <figcaption>Turned right</figcaption>
                  </figure>
                </div>
              )}
            </section>

            <div className="detail-side">
              <section className="card">
                <h3 className="card-title">Check-in info</h3>
                <dl className="info-list">
                  {isHrd && (
                    <>
                      <dt>Employee</dt>
                      <dd>{employee?.fullName ?? '-'}</dd>
                      <dt>Employee code</dt>
                      <dd>{employee?.employeeCode ?? '-'}</dd>
                      <dt>Department</dt>
                      <dd>{employee?.department ?? '-'}</dd>
                      <dt>Status</dt>
                      <dd>{employee ? <StatusBadge active={employee.isActive} /> : '-'}</dd>
                    </>
                  )}
                  <dt>Date</dt>
                  <dd>{formatDate(record.attendanceDate)}</dd>
                  <dt>Check-in time</dt>
                  <dd>{formatTime(record.checkedInAt)}</dd>
                  <dt>Check-out time</dt>
                  <dd>{record.checkedOutAt ? formatTime(record.checkedOutAt) : 'Not checked out'}</dd>
                  {record.checkedOutAt && (
                    <>
                      <dt>Work duration</dt>
                      <dd>{formatDuration(record.checkedInAt, record.checkedOutAt)}</dd>
                    </>
                  )}
                  <dt>Photo</dt>
                  <dd>
                    {record.photoSource === 'UPLOAD' ? (
                      <span className="badge badge-warning">Uploaded file</span>
                    ) : record.photoSource === 'CAMERA' ? (
                      <span className="badge badge-success">Live camera</span>
                    ) : (
                      '-'
                    )}
                  </dd>
                </dl>
              </section>

              <section className="card">
                <h3 className="card-title">Agenda</h3>
                <p className="note-text">
                  {record.note || <span className="muted">No agenda (check-in made before notes were added).</span>}
                </p>
              </section>

              <section className="card">
                <h3 className="card-title">Location</h3>
                {record.latitude !== null && record.longitude !== null ? (
                  <LocationMap
                    latitude={record.latitude}
                    longitude={record.longitude}
                    accuracy={record.locationAccuracy}
                  />
                ) : (
                  <div className="empty-state">
                    <MapPinOff size={24} />
                    <p>No GPS location (check-in made before location was required).</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// Shows if the employee passed the head-turn face check
function FaceCheckBadge({ record }: { record: Attendance }) {
  if (record.livenessChecked) {
    return <span className="badge badge-success">Face check passed</span>
  }

  if (record.photoSource === 'UPLOAD') {
    return <span className="badge badge-warning">No face check (uploaded)</span>
  }

  return <span className="badge badge-muted">No face check</span>
}
