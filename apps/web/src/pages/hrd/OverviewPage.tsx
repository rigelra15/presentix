import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Clock3, UserCheck, Users } from 'lucide-react'
import { api, type Attendance, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatTime, getWibToday } from '../../lib/format'
import { Alert, EmptyState, Loading, PageHeader, StatCard } from '../../components/ui'

export default function OverviewPage() {
  const { token } = useSession()
  const today = getWibToday()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Load from both services at the same time
    Promise.all([
      api<Employee[]>('/api/employee/employees', { token }),
      api<Attendance[]>('/api/attendance/attendances', { token })
    ])
      .then(([employeeData, attendanceData]) => {
        setEmployees(employeeData)
        setRecords(attendanceData)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <Loading />
  }

  const activeEmployees = employees.filter(e => e.isActive)
  const todayRecords = records.filter(r => r.attendanceDate === today)
  const checkedInIds = new Set(todayRecords.map(r => r.employeeId))
  const notCheckedIn = activeEmployees.filter(e => !checkedInIds.has(e.id))

  const attendanceRate = activeEmployees.length
    ? Math.round((todayRecords.length / activeEmployees.length) * 100)
    : 0

  function employeeName(id: number) {
    return employees.find(e => e.id === id)?.fullName ?? `Employee #${id}`
  }

  return (
    <>
      <PageHeader title="Overview" description={`Attendance summary for ${formatDate(today)}`} />

      {error && <Alert type="error">{error}</Alert>}

      <div className="stats-grid">
        <StatCard
          label="Active employees"
          value={activeEmployees.length}
          hint={`${employees.length} in total`}
          icon={<Users size={20} />}
        />
        <StatCard
          label="Checked in today"
          value={todayRecords.length}
          hint={`${attendanceRate}% attendance`}
          icon={<UserCheck size={20} />}
        />
        <StatCard
          label="Not checked in yet"
          value={notCheckedIn.length}
          icon={<Clock3 size={20} />}
        />
      </div>

      <div className="two-columns">
        <section className="card table-card">
          <div className="card-header">
            <h3 className="card-title">Today's check-ins</h3>
            <Link to="/hrd/attendance" className="link-inline">View all</Link>
          </div>

          {todayRecords.length === 0 ? (
            <EmptyState message="No one has checked in today." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {todayRecords.map(record => (
                  <tr key={record.id}>
                    <td>{employeeName(record.employeeId)}</td>
                    <td>{formatTime(record.checkedInAt)}</td>
                    <td className="cell-right">
                      <Link to={`/hrd/attendance/${record.id}`} className="link-inline">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h3 className="card-title">Not checked in yet</h3>

          {notCheckedIn.length === 0 ? (
            <div className="all-done">
              <CheckCircle2 size={20} />
              Everyone has checked in today.
            </div>
          ) : (
            <ul className="people-list">
              {notCheckedIn.map(employee => (
                <li key={employee.id}>
                  <span className="avatar avatar-sm">{employee.fullName[0]}</span>
                  <div>
                    <strong>{employee.fullName}</strong>
                    <small>{employee.department}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
