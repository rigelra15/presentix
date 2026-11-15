import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Clock, ListChecks } from 'lucide-react'
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
              <table className="table table-clickable">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check-in time</th>
                    <th>Agenda</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(record => (
                    <tr key={record.id}>
                      <td>
                        <Link to={`/history/${record.id}`} className="row-link">
                          <strong>{formatDate(record.attendanceDate)}</strong>
                        </Link>
                      </td>
                      <td>{formatTime(record.checkedInAt)}</td>
                      <td>
                        <span className="note-preview" title={record.note ?? undefined}>
                          {record.note || '-'}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success">Present</span>
                      </td>
                      <td className="cell-right">
                        <Link to={`/history/${record.id}`} className="icon-link" aria-label="View details">
                          <ChevronRight size={18} />
                        </Link>
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
