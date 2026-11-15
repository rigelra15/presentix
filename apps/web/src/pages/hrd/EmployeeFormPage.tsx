import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { api, type Employee } from '../../lib/api'
import { useSession } from '../../lib/auth-context'
import { Alert, Loading, PageHeader } from '../../components/ui'

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
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      .then(employee => {
        setForm({
          fullName: employee.fullName,
          employeeCode: employee.employeeCode,
          department: employee.department,
          email: employee.email,
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

  if (loading) {
    return <Loading />
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

      <form className="card form-card" onSubmit={handleSubmit}>
        {error && <Alert type="error">{error}</Alert>}

        <h3 className="form-section">Employee data</h3>

        <div className="form-grid">
          <label className="field">
            <span>Full name</span>
            <input
              value={form.fullName}
              onChange={event => updateField('fullName', event.target.value)}
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
              placeholder="Finance"
              maxLength={100}
              required
            />
          </label>
        </div>

        <h3 className="form-section">Login account</h3>

        <div className="form-grid">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={event => updateField('email', event.target.value)}
              maxLength={255}
              autoComplete="off"
              required
            />
          </label>

          {!isEdit && (
            <label className="field">
              <span>Initial password</span>
              <input
                type="password"
                value={form.password}
                onChange={event => updateField('password', event.target.value)}
                minLength={8}
                maxLength={128}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,128}"
                title="At least 8 characters with an uppercase letter, a lowercase letter and a number"
                autoComplete="new-password"
                required
              />
              <small>Min 8 characters, with uppercase, lowercase and a number.</small>
            </label>
          )}
        </div>

        <div className="form-actions">
          <Link to="/hrd/employees" className="btn btn-ghost">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add employee'}
          </button>
        </div>
      </form>
    </>
  )
}
