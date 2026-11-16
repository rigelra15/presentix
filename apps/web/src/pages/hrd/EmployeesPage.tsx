import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Pencil, Plus, Search, Trash2, UserCheck, UserX } from 'lucide-react'
import { api, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { Alert, EmptyState, Loading, PageHeader, StatusBadge } from '../../components/ui'
import EmployeeActionDialog, { type EmployeeAction } from '../../components/EmployeeActionDialog'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../lib/use-pagination'

type StatusFilter = 'all' | 'active' | 'inactive'

export default function EmployeesPage() {
  const { token } = useSession()
  // Success message sent by the form page after saving
  const location = useLocation()
  const savedMessage = (location.state as { notice?: string } | null)?.notice

  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  // Which action the confirmation modal is asking about
  const [pending, setPending] = useState<{ action: EmployeeAction; employee: Employee } | null>(null)
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

  function openDialog(action: EmployeeAction, employee: Employee) {
    setNotice('')
    setError('')
    setPending({ action, employee })
  }

  // Called by the modal after the API call succeeded
  function handleDone(updated: Employee | null, message: string) {
    const id = pending?.employee.id

    if (updated) {
      setEmployees(list => list.map(e => (e.id === updated.id ? updated : e)))
    } else {
      // Deleted: remove the row
      setEmployees(list => list.filter(e => e.id !== id))
    }

    setNotice(message)
    setPending(null)
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

  // 10 employees per page. Changing a filter goes back to page 1.
  const pages = usePagination(filtered, `${query}|${statusFilter}`, 10)

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
              {pages.pageItems.map(employee => (
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
                      {employee.isActive ? (
                        <button
                          type="button"
                          className="btn btn-icon btn-danger-ghost"
                          onClick={() => openDialog('deactivate', employee)}
                          title="Deactivate"
                          aria-label={`Deactivate ${employee.fullName}`}
                        >
                          <UserX size={16} />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-icon btn-ghost"
                            onClick={() => openDialog('reactivate', employee)}
                            title="Reactivate"
                            aria-label={`Reactivate ${employee.fullName}`}
                          >
                            <UserCheck size={16} />
                          </button>
                          {/* Permanent delete is only offered for inactive employees */}
                          <button
                            type="button"
                            className="btn btn-icon btn-danger-ghost"
                            onClick={() => openDialog('delete', employee)}
                            title="Delete permanently"
                            aria-label={`Delete ${employee.fullName} permanently`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && filtered.length > 0 && (
          <Pagination
            {...pages}
            total={filtered.length}
            allCount={employees.length}
            label="employees"
            onChange={pages.setPage}
          />
        )}
      </div>

      {pending && (
        <EmployeeActionDialog
          // A new key gives every dialog a fresh state
          key={`${pending.action}-${pending.employee.id}`}
          token={token}
          action={pending.action}
          employee={pending.employee}
          onClose={() => setPending(null)}
          onDone={handleDone}
        />
      )}
    </>
  )
}
