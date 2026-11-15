import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Pencil, Plus, Search, UserCheck, UserX } from 'lucide-react'
import { api, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { Alert, EmptyState, Loading, PageHeader, StatusBadge } from '../../components/ui'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function EmployeesPage() {
  const { token } = useSession()
  // Success message sent by the form page after saving
  const location = useLocation()
  const savedMessage = (location.state as { notice?: string } | null)?.notice

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(savedMessage ?? '')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    api<Employee[]>('/api/employee/employees', { token })
      .then(setEmployees)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load employees'))
      .finally(() => setLoading(false))
  }, [token])

  async function toggleStatus(employee: Employee) {
    if (employee.isActive) {
      const ok = window.confirm(
        `Deactivate ${employee.fullName}? This employee will no longer be able to log in.`
      )
      if (!ok) return
    }

    setBusyId(employee.id)
    setError('')
    setNotice('')

    try {
      // DELETE deactivates, PATCH isActive=true reactivates
      const updated = employee.isActive
        ? await api<Employee>(`/api/employee/employees/${employee.id}`, {
            token,
            method: 'DELETE'
          })
        : await api<Employee>(`/api/employee/employees/${employee.id}`, {
            token,
            method: 'PATCH',
            body: { isActive: true }
          })

      setEmployees(list => list.map(e => (e.id === updated.id ? updated : e)))
      setNotice(`${updated.fullName} has been ${updated.isActive ? 'reactivated' : 'deactivated'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change status')
    } finally {
      setBusyId(null)
    }
  }

  const query = search.trim().toLowerCase()

  const filtered = employees.filter(employee => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? employee.isActive : !employee.isActive)

    const matchesSearch =
      !query ||
      [employee.fullName, employee.email, employee.employeeCode, employee.department]
        .some(value => value.toLowerCase().includes(query))

    return matchesStatus && matchesSearch
  })

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage employee data and login accounts."
        actions={
          <Link to="/hrd/employees/new" className="btn btn-primary">
            <Plus size={16} />
            Add employee
          </Link>
        }
      />

      {notice && <Alert type="success">{notice}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      <div className="card table-card">
        <div className="toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search name, email, code or department"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState message={employees.length === 0 ? 'No employees yet.' : 'No employees match your search.'} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Department</th>
                <th>Status</th>
                <th className="cell-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(employee => (
                <tr key={employee.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar avatar-sm">{employee.fullName[0]}</span>
                      <div>
                        <strong>{employee.fullName}</strong>
                        <small>{employee.email}</small>
                      </div>
                    </div>
                  </td>
                  <td><code>{employee.employeeCode}</code></td>
                  <td>{employee.department}</td>
                  <td><StatusBadge active={employee.isActive} /></td>
                  <td className="cell-right">
                    <div className="row-actions">
                      <Link
                        to={`/hrd/employees/${employee.id}/edit`}
                        className="btn btn-ghost btn-icon"
                        title="Edit"
                        aria-label={`Edit ${employee.fullName}`}
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        className={`btn btn-icon ${employee.isActive ? 'btn-danger-ghost' : 'btn-ghost'}`}
                        onClick={() => toggleStatus(employee)}
                        disabled={busyId === employee.id}
                        title={employee.isActive ? 'Deactivate' : 'Reactivate'}
                        aria-label={`${employee.isActive ? 'Deactivate' : 'Reactivate'} ${employee.fullName}`}
                      >
                        {employee.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
