import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Download, List, MapPin, Search } from 'lucide-react'
import { api, type Attendance, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { formatDate, formatDuration, formatTime, getWibToday } from '../../lib/format'
import { downloadCsv, toCsv } from '../../lib/csv'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../lib/use-pagination'
import { Alert, EmptyState, Loading, PageHeader, WorkHours } from '../../components/ui'
import TeamCalendar from '../../components/TeamCalendar'

export default function AttendancePage() {
  const { token } = useSession()

  const [records, setRecords] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')
  const [department, setDepartment] = useState('')
  const [view, setView] = useState<'list' | 'calendar'>('list')

  // CSV export modal. The month is "YYYY-MM", this month by default.
  const [exportOpen, setExportOpen] = useState(false)
  const [exportMonth, setExportMonth] = useState(getWibToday().slice(0, 7))
  const [exportError, setExportError] = useState('')

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

  // Downloads one month of attendance as a CSV file.
  // The search and department filters are used, the date filter is not.
  function handleExport() {
    if (!/^\d{4}-\d{2}$/.test(exportMonth)) {
      setExportError('Please choose a month.')
      return
    }

    const monthRecords = records
      .filter(record => record.attendanceDate.startsWith(exportMonth))
      .filter(record => {
        const employee = findEmployee(record.employeeId)
        const matchesSearch =
          !query ||
          [employee?.fullName ?? '', employee?.employeeCode ?? '']
            .some(value => value.toLowerCase().includes(query))

        return matchesSearch && (!department || employee?.department === department)
      })
      .sort((a, b) => a.attendanceDate.localeCompare(b.attendanceDate) || a.checkedInAt.localeCompare(b.checkedInAt))

    if (monthRecords.length === 0) {
      setExportError('There are no check-ins in this month for the current filters.')
      return
    }

    const header = [
      'Employee', 'Employee code', 'Department', 'Date',
      'Check-in (WIB)', 'Check-out (WIB)', 'Work duration',
      'Photo', 'Face check', 'Latitude', 'Longitude', 'Accuracy (m)', 'Agenda'
    ]

    const rows = monthRecords.map(record => {
      const employee = findEmployee(record.employeeId)

      return [
        employee?.fullName ?? `Employee #${record.employeeId}`,
        employee?.employeeCode ?? '',
        employee?.department ?? '',
        record.attendanceDate,
        formatTime(record.checkedInAt).replace(' WIB', ''),
        record.checkedOutAt ? formatTime(record.checkedOutAt).replace(' WIB', '') : '',
        record.checkedOutAt ? formatDuration(record.checkedInAt, record.checkedOutAt) : '',
        record.photoSource === 'UPLOAD' ? 'Uploaded' : record.photoSource === 'CAMERA' ? 'Camera' : '',
        record.livenessChecked ? 'Passed' : 'Not done',
        record.latitude,
        record.longitude,
        record.locationAccuracy,
        record.note ?? ''
      ]
    })

    downloadCsv(`attendance-${exportMonth}.csv`, toCsv(header, rows))
    setExportOpen(false)
  }

  // 20 rows per page. Changing a filter goes back to page 1.
  const pages = usePagination(filtered, `${query}|${date}|${department}`, 20)

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Check-ins submitted by employees (view only)."
        actions={
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setExportError('')
                setExportOpen(true)
              }}
              disabled={loading || records.length === 0}
            >
              <Download size={16} />
              Export CSV
            </button>
            <div className="segmented" role="group" aria-label="View">
              <button
                type="button"
                className={view === 'list' ? 'active' : ''}
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
              >
                <List size={16} />
                List
              </button>
              <button
                type="button"
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
                aria-pressed={view === 'calendar'}
              >
                <CalendarDays size={16} />
                Calendar
              </button>
            </div>
          </div>
        }
      />

      <ConfirmDialog
        open={exportOpen}
        title="Export attendance"
        confirmLabel="Download CSV"
        error={exportError}
        onConfirm={handleExport}
        onClose={() => setExportOpen(false)}
      >
        <p>Download one month of check-ins as a CSV file (opens in Excel or Google Sheets).</p>
        <label className="field">
          <span>Month</span>
          <input
            type="month"
            value={exportMonth}
            max={getWibToday().slice(0, 7)}
            onChange={event => {
              setExportMonth(event.target.value)
              setExportError('')
            }}
            required
          />
        </label>
        {(query || department) && (
          <p className="muted">Only employees that match the current search and department filter are included.</p>
        )}
      </ConfirmDialog>

      {error && <Alert type="error">{error}</Alert>}

      {view === 'calendar' ? (
        <div className="card table-card">
          {loading ? (
            <Loading />
          ) : (
            <TeamCalendar
              records={records}
              employees={employees}
              onOpenDay={day => {
                // Show the list for that day
                setSearch('')
                setDepartment('')
                setDate(day)
                setView('list')
              }}
            />
          )}
        </div>
      ) : (
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
                    <th>Check-in / out</th>
                    <th>Agenda</th>
                    <th>Photo</th>
                    <th>Location</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pages.pageItems.map(record => {
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
                        <td><WorkHours checkedInAt={record.checkedInAt} checkedOutAt={record.checkedOutAt} /></td>
                        <td>
                          <span className="note-preview" title={record.note ?? undefined}>
                            {record.note || '-'}
                          </span>
                        </td>
                        <td>
                          {record.photoSource === 'UPLOAD' ? (
                            <span className="badge badge-warning">Uploaded</span>
                          ) : record.livenessChecked ? (
                            <span className="badge badge-success">Face check</span>
                          ) : record.photoSource === 'CAMERA' ? (
                            <span className="badge badge-muted">Camera</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
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
              <Pagination
                {...pages}
                total={filtered.length}
                allCount={records.length}
                label="records"
                onChange={pages.setPage}
              />
            </>
          )}
        </div>
      )}
    </>
  )
}
