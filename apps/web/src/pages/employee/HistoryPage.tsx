import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, Clock, ListChecks } from 'lucide-react'
import { api, type Attendance, type SessionUser } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatTime, getWibToday, toWibDate } from '../../lib/format'
import { getEmployeeDay, getMonthDates } from '../../lib/calendar'
import { Alert, EmptyState, Loading, PageHeader, StatCard, WorkHours } from '../../components/ui'
import AttendanceCalendar from '../../components/AttendanceCalendar'

export default function HistoryPage() {
  const { token } = useSession()
  const navigate = useNavigate()
  const today = getWibToday()
  const [month, setMonth] = useState(today.slice(0, 7))

  const [records, setRecords] = useState<Attendance[]>([])
  // When the account was created. Loaded fresh, because a session saved
  // in the browser before this field existed does not have it.
  const [accountCreatedAt, setAccountCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api<SessionUser>('/api/employee/auth/me', { token })
      .then(me => setAccountCreatedAt(me.createdAt ?? null))
      .catch(() => {
        // Not critical: the calendar falls back to the first check-in
      })

    api<Attendance[]>('/api/attendance/attendances/me', { token })
      .then(setRecords)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [token])

  // "2026-11" -> count check-ins in the current month
  const thisMonth = getWibToday().slice(0, 7)
  const monthCount = records.filter(r => r.attendanceDate.startsWith(thisMonth)).length
  const lastRecord = records[0] // newest first

  // Calendar: find the check-in of a day quickly
  const recordByDate = new Map(records.map(record => [record.attendanceDate, record]))
  // Absent is only counted after the account was created.
  // Fallback: the first check-in (records are newest first).
  const firstCheckIn = records.length > 0 ? records[records.length - 1].attendanceDate : null
  const startDate = accountCreatedAt ? toWibDate(accountCreatedAt) : firstCheckIn

  function getDay(date: string) {
    const record = recordByDate.get(date)
    return getEmployeeDay(date, today, startDate, record ? formatTime(record.checkedInAt) : null)
  }

  // Summary of the month shown in the calendar
  const monthStatuses = getMonthDates(month).map(date => getDay(date).status)
  const presentDays = monthStatuses.filter(status => status === 'present').length
  const absentDays = monthStatuses.filter(status => status === 'absent').length

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

          <div className="card">
            <AttendanceCalendar
              month={month}
              onMonthChange={setMonth}
              getDay={getDay}
              onDayClick={date => {
                const record = recordByDate.get(date)
                if (record) navigate(`/history/${record.id}`)
              }}
              summary={
                <>
                  <span className="badge badge-success">{presentDays} checked in</span>
                  <span className="badge badge-danger">{absentDays} absent</span>
                </>
              }
              legend={[
                { status: 'present', label: 'Checked in' },
                { status: 'absent', label: 'Absent (work day)' },
                { status: 'off', label: 'Weekend' }
              ]}
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
                    <th>Check-in / out</th>
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
                      <td><WorkHours checkedInAt={record.checkedInAt} checkedOutAt={record.checkedOutAt} /></td>
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
