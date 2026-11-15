import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, MapPin, Search } from 'lucide-react'
import { api, type Attendance, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatTime, getWibToday } from '../../lib/format'
import { Alert, EmptyState, Loading, PageHeader } from '../../components/ui'

export default function AttendancePage() {
  const { token } = useSession()

  const [records, setRecords] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [department, setDepartment] = useState('')

  useEffect(() => {
    // Attendance only stores employeeId, so employee names
    // come from the employee service.
    Promise.all([
      api<Attendance[]>('/api/attendance/attendances', { token }),
      api<Employee[]>('/api/employee/employees', { token })
    ])
      .then(([attendanceData, employeeData]) => {
        setRecords(attendanceData)
        setEmployees(employeeData)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load attendance'))
      .finally(() => setLoading(false))
  }, [token])

  function findEmployee(id: number) {
    return employees.find(e => e.id === id)
  }

  const departments = [...new Set(employees.map(e => e.department))].sort()
  const query = search.trim().toLowerCase()

  const filtered = records.filter(record => {
    const employee = findEmployee(record.employeeId)

    const matchesSearch =
      !query ||
      [employee?.fullName ?? '', employee?.employeeCode ?? '']
        .some(value => value.toLowerCase().includes(query))

    const matchesDate = !date || record.attendanceDate === date
    const matchesDepartment = !department || employee?.department === department

    return matchesSearch && matchesDate && matchesDepartment
  })

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Check-ins submitted by employees (view only)."
      />

      {error && <Alert type="error">{error}</Alert>}

      <div className="card table-card">
        <div className="toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search name or employee code"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <select value={department} onChange={event => setDepartment(event.target.value)}>
            <option value="">All departments</option>
            {departments.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <input
            type="date"
            value={date}
            onChange={event => setDate(event.target.value)}
            aria-label="Filter by date"
          />

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDate(getWibToday())}>
            Today
          </button>

          {(search || date || department) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSearch('')
                setDate('')
                setDepartment('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState message="No attendance records found." />
        ) : (
          <>
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Agenda</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(record => {
                  const employee = findEmployee(record.employeeId)

                  return (
                    <tr key={record.id}>
                      <td>
                        <Link to={`/hrd/attendance/${record.id}`} className="row-link">
                          <strong>{employee?.fullName ?? `Employee #${record.employeeId}`}</strong>
                          <small>{employee?.employeeCode}</small>
                        </Link>
                      </td>
                      <td>{employee?.department ?? '-'}</td>
                      <td>{formatDate(record.attendanceDate)}</td>
                      <td>{formatTime(record.checkedInAt)}</td>
                      <td>
                        <span className="note-preview" title={record.note ?? undefined}>
                          {record.note || '-'}
                        </span>
                      </td>
                      <td>
                        {record.latitude !== null ? (
                          <span className="badge badge-info">
                            <MapPin size={12} />
                            Recorded
                          </span>
                        ) : (
                          <span className="badge badge-muted">No GPS</span>
                        )}
                      </td>
                      <td className="cell-right">
                        <Link to={`/hrd/attendance/${record.id}`} className="icon-link" aria-label="View details">
                          <ChevronRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="table-footer">{filtered.length} of {records.length} records</p>
          </>
        )}
      </div>
    </>
  )
}
