import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPinOff } from 'lucide-react'
import { api, type Attendance, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatTime } from '../../lib/format'
import { Alert, Loading, PageHeader, StatusBadge } from '../../components/ui'
import LocationMap from '../../components/LocationMap'
import ProtectedPhoto from '../../components/ProtectedPhoto'

export default function AttendanceDetailPage() {
  const { token } = useSession()
  const { id } = useParams()

  const [record, setRecord] = useState<Attendance | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const attendance = await api<Attendance>(`/api/attendance/attendances/${id}`, { token })
        setRecord(attendance)

        // The employee may have been removed from the list, so this one can fail quietly
        const owner = await api<Employee>(
          `/api/employee/employees/${attendance.employeeId}`,
          { token }
        ).catch(() => null)
        setEmployee(owner)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [id, token])

  if (loading) {
    return <Loading />
  }

  return (
    <>
      <Link to="/hrd/attendance" className="back-link">
        <ArrowLeft size={16} />
        Back to attendance
      </Link>

      {error || !record ? (
        <Alert type="error">{error || 'Attendance not found'}</Alert>
      ) : (
        <>
          <PageHeader
            title={employee?.fullName ?? `Employee #${record.employeeId}`}
            description={`Check-in on ${formatDate(record.attendanceDate)}`}
          />

          <div className="detail-grid">
            <section className="card">
              <h3 className="card-title">Photo</h3>
              <ProtectedPhoto key={record.id} token={token} attendanceId={record.id} />
            </section>

            <div className="detail-side">
              <section className="card">
                <h3 className="card-title">Check-in info</h3>
                <dl className="info-list">
                  <dt>Employee</dt>
                  <dd>{employee?.fullName ?? '-'}</dd>
                  <dt>Employee code</dt>
                  <dd>{employee?.employeeCode ?? '-'}</dd>
                  <dt>Department</dt>
                  <dd>{employee?.department ?? '-'}</dd>
                  <dt>Status</dt>
                  <dd>{employee ? <StatusBadge active={employee.isActive} /> : '-'}</dd>
                  <dt>Date</dt>
                  <dd>{formatDate(record.attendanceDate)}</dd>
                  <dt>Check-in time</dt>
                  <dd>{formatTime(record.checkedInAt)}</dd>
                </dl>
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
