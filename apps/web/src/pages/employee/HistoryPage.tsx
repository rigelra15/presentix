import { useEffect, useState } from 'react'
import { CalendarDays, Clock, ListChecks, MapPin } from 'lucide-react'
import { api, type Attendance } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatTime, getWibToday } from '../../lib/format'
import { Alert, EmptyState, Loading, PageHeader, StatCard } from '../../components/ui'

export default function HistoryPage() {
  const { token } = useSession()

  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Attendance[]>('/api/attendance/attendances/me', { token })
      .then(setRecords)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [token])

  // "2026-11" -> count check-ins in the current month
  const thisMonth = getWibToday().slice(0, 7)
  const monthCount = records.filter(r => r.attendanceDate.startsWith(thisMonth)).length
  const lastRecord = records[0] // newest first

  return (
    <>
      <PageHeader title="My Attendance" description="All of your WFH check-ins." />

      {error && <Alert type="error">{error}</Alert>}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid">
            <StatCard label="Total check-ins" value={records.length} icon={<ListChecks size={20} />} />
            <StatCard label="This month" value={monthCount} icon={<CalendarDays size={20} />} />
            <StatCard
              label="Last check-in"
              value={lastRecord ? formatTime(lastRecord.checkedInAt) : '-'}
              hint={lastRecord ? formatDate(lastRecord.attendanceDate) : undefined}
              icon={<Clock size={20} />}
            />
          </div>

          <div className="card table-card">
            {records.length === 0 ? (
              <EmptyState message="You have not checked in yet." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check-in time</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td>{formatDate(record.attendanceDate)}</td>
                      <td>{formatTime(record.checkedInAt)}</td>
                      <td>
                        {record.latitude !== null && record.longitude !== null ? (
                          <a
                            className="link-inline"
                            href={`https://www.google.com/maps?q=${record.latitude},${record.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MapPin size={14} />
                            View on map
                          </a>
                        ) : (
                          <span className="muted">Not recorded</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-success">Present</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  )
}
