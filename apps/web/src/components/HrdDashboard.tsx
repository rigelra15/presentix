
import { useEffect, useState, type FormEvent } from 'react'
import { api, type Employee } from '../lib/api'
import HrdAttendanceMonitoring from './HrdAttendanceMonitoring'

interface Props {
  token: string
}

interface EmployeeForm {
  email: string
  password: string
  employeeCode: string
  fullName: string
  department: string
}

const emptyForm: EmployeeForm = {
  email: '',
  password: '',
  employeeCode: '',
  fullName: '',
  department: ''
}

export default function HrdDashboard({ token }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<EmployeeForm>({ ...emptyForm })

  useEffect(() => {
    let active = true

    api<Employee[]>('/api/employee/employees', { token })
      .then(data => {
        if (active) setEmployees(data)
      })
      .catch(err => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load employees'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  async function refreshEmployees() {
    const data = await api<Employee[]>(
      '/api/employee/employees',
      { token }
    )

    setEmployees(data)
  }

  function updateField(
    key: keyof EmployeeForm,
    value: string
  ) {
    setForm(current => ({
      ...current,
      [key]: value
    }))
  }

  function openCreateForm() {
    setEditingId(null)
    setForm({ ...emptyForm })
    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function openEditForm(employee: Employee) {
    setEditingId(employee.id)

    setForm({
      email: employee.email,
      password: '',
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department
    })

    setError('')
    setNotice('')
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm({ ...emptyForm })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy) return

    setBusy(true)
    setError('')
    setNotice('')

    const isEditing = editingId !== null

    const payload = {
      email: form.email.trim().toLowerCase(),
      employeeCode: form.employeeCode.trim(),
      fullName: form.fullName.trim(),
      department: form.department.trim()
    }

    try {
      if (isEditing) {
        await api<Employee>(
          `/api/employee/employees/${editingId}`,
          {
            token,
            method: 'PATCH',
            body: payload
          }
        )
      } else {
        await api<Employee>(
          '/api/employee/employees',
          {
            token,
            method: 'POST',
            body: {
              ...payload,
              password: form.password
            }
          }
        )
      }

      await refreshEmployees()
      closeForm()

      setNotice(
        isEditing
          ? 'Employee updated successfully.'
          : 'Employee created successfully.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save employee. Check the employee list before retrying.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(employee: Employee) {
    if (busy) return

    if (employee.isActive) {
      const confirmed = window.confirm(
        `Deactivate ${employee.fullName}? This employee will no longer be able to log in.`
      )

      if (!confirmed) return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      if (employee.isActive) {
        await api<Employee>(
          `/api/employee/employees/${employee.id}`,
          {
            token,
            method: 'DELETE'
          }
        )
      } else {
        await api<Employee>(
          `/api/employee/employees/${employee.id}`,
          {
            token,
            method: 'PATCH',
            body: { isActive: true }
          }
        )
      }

      await refreshEmployees()

      setNotice(
        employee.isActive
          ? 'Employee deactivated successfully.'
          : 'Employee reactivated successfully.'
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to change employee status.'
      )
    } finally {
      setBusy(false)
    }
  }

  const filteredEmployees = employees.filter(employee => {
    const query = search.trim().toLowerCase()

    return [
      employee.fullName,
      employee.email,
      employee.employeeCode,
      employee.department
    ].some(value => value.toLowerCase().includes(query))
  })

  return (
    <section className="hrd-management">
      <div className="hrd-toolbar">
        <div>
          <h2>Employee Management</h2>
          <p>Manage employee accounts and information.</p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          disabled={busy || loading}
        >
          + Add Employee
        </button>
      </div>

      {notice && (
        <p className="hrd-notice" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {formOpen && (
        <form
          className="hrd-form-card"
          onSubmit={handleSubmit}
        >
          <div className="hrd-form-header">
            <h3>
              {editingId === null
                ? 'Add Employee'
                : 'Edit Employee'}
            </h3>

            <button
              type="button"
              className="secondary-button"
              onClick={closeForm}
              disabled={busy}
            >
              Cancel
            </button>
          </div>

          <div className="hrd-form-grid">
            <label className="hrd-field">
              Full Name
              <input
                type="text"
                value={form.fullName}
                onChange={event =>
                  updateField('fullName', event.target.value)
                }
                maxLength={150}
                required
              />
            </label>

            <label className="hrd-field">
              Employee Code
              <input
                type="text"
                value={form.employeeCode}
                onChange={event =>
                  updateField('employeeCode', event.target.value)
                }
                maxLength={30}
                pattern="[A-Za-z0-9_-]+"
                required
              />
            </label>

            <label className="hrd-field">
              Email Address
              <input
                type="email"
                value={form.email}
                onChange={event =>
                  updateField('email', event.target.value)
                }
                maxLength={255}
                required
              />
            </label>

            <label className="hrd-field">
              Department
              <input
                type="text"
                value={form.department}
                onChange={event =>
                  updateField('department', event.target.value)
                }
                maxLength={100}
                required
              />
            </label>

            {editingId === null && (
              <label className="hrd-field">
                Initial Password
                <input
                  type="password"
                  value={form.password}
                  onChange={event =>
                    updateField('password', event.target.value)
                  }
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />
                <small>Minimum 12 characters.</small>
              </label>
            )}
          </div>

          <div className="hrd-form-actions">
            <button
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Saving...'
                : editingId === null
                  ? 'Create Employee'
                  : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      <div className="hrd-list-toolbar">
        <div>
          <strong>All Employees</strong>
          <p>{employees.length} registered employees</p>
        </div>

        <input
          type="search"
          placeholder="Search employees..."
          aria-label="Search employees"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading employees...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Code</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee.id}>
                  <td>
                    <strong>{employee.fullName}</strong>
                    <small>{employee.email}</small>
                  </td>

                  <td>{employee.employeeCode}</td>
                  <td>{employee.department}</td>

                  <td>
                    <span className={
                      employee.isActive
                        ? 'status active'
                        : 'status inactive'
                    }>
                      {employee.isActive
                        ? 'Active'
                        : 'Inactive'}
                    </span>
                  </td>

                  <td>
                    <div className="hrd-row-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={busy}
                        onClick={() => openEditForm(employee)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className={
                          employee.isActive
                            ? 'danger-button'
                            : 'secondary-button'
                        }
                        disabled={busy}
                        onClick={() => changeStatus(employee)}
                      >
                        {employee.isActive
                          ? 'Deactivate'
                          : 'Reactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    No matching employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <HrdAttendanceMonitoring
        token={token}
        employees={employees}
      />
    </section>
  )
}
