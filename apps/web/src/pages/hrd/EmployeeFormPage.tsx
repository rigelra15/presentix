import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Save, Trash2, UserCheck, UserX } from 'lucide-react'
import { api, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { Alert, Loading, PageHeader, StatusBadge } from '../../components/ui'
import EmployeeActionDialog, { type EmployeeAction } from '../../components/EmployeeActionDialog'

interface EmployeeForm {
  fullName: string
  employeeCode: string
  department: string
  email: string
  password: string
}

const emptyForm: EmployeeForm = {
  fullName: '',
  employeeCode: '',
  department: '',
  email: '',
  password: ''
}

// One page for both "Add employee" (/hrd/employees/new)
// and "Edit employee" (/hrd/employees/:id/edit)
export default function EmployeeFormPage() {
  const { token } = useSession()
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = id !== undefined

  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  // The saved employee (edit only), used for the status section
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [dialog, setDialog] = useState<EmployeeAction | null>(null)

  // When adding, fill in the next free employee code.
  // HRD can still change it by hand.
  useEffect(() => {
    if (isEdit) return

    api<{ employeeCode: string }>('/api/employee/employees/next-code', { token })
      .then(result => {
        // Do not overwrite a code HRD already typed
        setForm(current =>
          current.employeeCode ? current : { ...current, employeeCode: result.employeeCode }
        )
      })
      .catch(() => {
        // Not a problem: HRD can type the code manually
      })
  }, [isEdit, token])

  // When editing, load the current data into the form
  useEffect(() => {
    if (!isEdit) return

    api<Employee>(`/api/employee/employees/${id}`, { token })
      .then(loaded => {
        setEmployee(loaded)
        setForm({
          fullName: loaded.fullName,
          employeeCode: loaded.employeeCode,
          department: loaded.department,
          email: loaded.email,
          password: ''
        })
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load employee'))
      .finally(() => setLoading(false))
  }, [id, isEdit, token])

  function updateField(field: keyof EmployeeForm, value: string) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload = {
      fullName: form.fullName.trim(),
      employeeCode: form.employeeCode.trim(),
      department: form.department.trim(),
      email: form.email.trim().toLowerCase()
    }

    try {
      if (isEdit) {
        await api<Employee>(`/api/employee/employees/${id}`, {
          token,
          method: 'PATCH',
          body: payload
        })
      } else {
        await api<Employee>('/api/employee/employees', {
          token,
          method: 'POST',
          body: { ...payload, password: form.password }
        })
      }

      navigate('/hrd/employees', {
        state: {
          notice: isEdit
            ? `${payload.fullName} has been updated.`
            : `${payload.fullName} has been added. They can now log in.`
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save employee')
      setSaving(false)
    }
  }

  // Called by the modal after deactivate / reactivate / delete
  function handleActionDone(updated: Employee | null, message: string) {
    setDialog(null)

    if (!updated) {
      // Deleted: this page has nothing left to edit
      navigate('/hrd/employees', { state: { notice: message } })
      return
    }

    setEmployee(updated)
    setNotice(message)
  }

  if (loading) {
    return <Loading />
  }

  if (isEdit && !employee) {
    return (
      <>
        <Link to="/hrd/employees" className="back-link">
          <ArrowLeft size={16} />
          Back to employees
        </Link>
        <Alert type="error">{error || 'Employee not found'}</Alert>
      </>
    )
  }

  return (
    <>
      <Link to="/hrd/employees" className="back-link">
        <ArrowLeft size={16} />
        Back to employees
      </Link>

      <PageHeader
        title={isEdit ? 'Edit employee' : 'Add employee'}
        description={
          isEdit
            ? 'Update employee data. The password is not changed here.'
            : 'Create employee data and a login account.'
        }
      />

      {notice && <Alert type="success">{notice}</Alert>}

      <form className="form-layout" onSubmit={handleSubmit}>
        {error && <Alert type="error">{error}</Alert>}

        <section className="card form-section-card">
          <div className="form-section-head">
            <h3>Employee data</h3>
            <p>Shown to HRD on the employee and attendance pages.</p>
          </div>

          <div className="form-grid">
            <label className="field field-full">
              <span>Full name</span>
              <input
                value={form.fullName}
                onChange={event => updateField('fullName', event.target.value)}
                placeholder="e.g. Budi Santoso"
                maxLength={150}
                required
              />
            </label>

            <label className="field">
              <span>Employee code</span>
              <input
                value={form.employeeCode}
                onChange={event => updateField('employeeCode', event.target.value)}
                placeholder="EMP-0001"
                maxLength={30}
                pattern="[A-Za-z0-9_\-]+"
                title="Letters, numbers, - and _ only"
                required
              />
              {!isEdit && <small>Filled in automatically. You can change it.</small>}
            </label>

            <label className="field">
              <span>Department</span>
              <input
                value={form.department}
                onChange={event => updateField('department', event.target.value)}
                placeholder="e.g. Finance"
                maxLength={100}
                required
              />
            </label>
          </div>
        </section>

        <section className="card form-section-card">
          <div className="form-section-head">
            <h3>Login account</h3>
            <p>
              {isEdit
                ? 'The email the employee uses to log in.'
                : 'The employee logs in with this email and password.'}
            </p>
          </div>

          <div className="form-grid">
            <label className={`field ${isEdit ? 'field-full' : ''}`}>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={event => updateField('email', event.target.value)}
                placeholder="name@company.com"
                maxLength={255}
                autoComplete="off"
                required
              />
            </label>

            {!isEdit && (
              <label className="field">
                <span>Initial password</span>
                <div className="password-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={event => updateField('password', event.target.value)}
                    minLength={8}
                    maxLength={128}
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}"
                    title="At least 8 characters with an uppercase letter, a lowercase letter and a number"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => setShowPassword(value => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small>Min 8 characters, with uppercase, lowercase and a number.</small>
              </label>
            )}
          </div>
        </section>

        <div className="form-actions">
          <Link to="/hrd/employees" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add employee'}
          </button>
        </div>
      </form>

      {/* Status and delete live outside the form so they are not "saved" with it */}
      {employee && (
        <section className="card form-section-card danger-zone">
          <div className="form-section-head">
            <h3>Account status</h3>
            <p>
              Current status: <StatusBadge active={employee.isActive} />
            </p>
          </div>

          <div className="danger-actions">
            {employee.isActive ? (
              <div className="danger-row">
                <div>
                  <strong>Deactivate employee</strong>
                  <p>They can no longer log in. Attendance history is kept.</p>
                </div>
                <button type="button" className="btn btn-danger-outline" onClick={() => setDialog('deactivate')}>
                  <UserX size={16} />
                  Deactivate
                </button>
              </div>
            ) : (
              <div className="danger-row">
                <div>
                  <strong>Reactivate employee</strong>
                  <p>They can log in and check in again.</p>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setDialog('reactivate')}>
                  <UserCheck size={16} />
                  Reactivate
                </button>
              </div>
            )}

            <div className="danger-row">
              <div>
                <strong>Delete permanently</strong>
                <p>
                  {employee.isActive
                    ? 'Deactivate the employee first. Only employees without attendance records can be deleted.'
                    : 'Removes the employee and their login account. Only possible without attendance records.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setDialog('delete')}
                disabled={employee.isActive}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </section>
      )}

      {employee && dialog && (
        <EmployeeActionDialog
          key={dialog}
          token={token}
          action={dialog}
          employee={employee}
          onClose={() => setDialog(null)}
          onDone={handleActionDone}
        />
      )}
    </>
  )
}
