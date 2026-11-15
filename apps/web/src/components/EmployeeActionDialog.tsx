import { useState } from 'react'
import { api, type Employee } from '../lib/api'
import ConfirmDialog from './ConfirmDialog'

export type EmployeeAction = 'deactivate' | 'reactivate' | 'delete'

interface Props {
  token: string
  // The dialog is open while this is set
  action: EmployeeAction | null
  employee: Employee
  onClose: () => void
  // updated = new employee data, or null when the employee was deleted
  onDone: (updated: Employee | null, message: string) => void
}

// Confirmation + API call for deactivate, reactivate and permanent delete.
// Used on the employee list and on the edit page.
export default function EmployeeActionDialog({ token, action, employee, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = employee.fullName

  function close() {
    setError('')
    onClose()
  }

  async function confirm() {
    setBusy(true)
    setError('')

    try {
      if (action === 'deactivate') {
        // DELETE /employees/:id only sets is_active = false
        const updated = await api<Employee>(`/api/employee/employees/${employee.id}`, {
          token,
          method: 'DELETE'
        })
        onDone(updated, `${name} has been deactivated.`)
      } else if (action === 'reactivate') {
        const updated = await api<Employee>(`/api/employee/employees/${employee.id}`, {
          token,
          method: 'PATCH',
          body: { isActive: true }
        })
        onDone(updated, `${name} has been reactivated.`)
      } else if (action === 'delete') {
        await api(`/api/employee/employees/${employee.id}/permanent`, {
          token,
          method: 'DELETE'
        })
        onDone(null, `${name} has been permanently deleted.`)
      }
    } catch (err) {
      // Keep the dialog open and show why it failed
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (action === 'deactivate') {
    return (
      <ConfirmDialog
        open
        title="Deactivate employee?"
        confirmLabel="Deactivate"
        danger
        busy={busy}
        error={error}
        onConfirm={confirm}
        onClose={close}
      >
        <p>
          <strong>{name}</strong> will not be able to log in or check in anymore.
        </p>
        <p>Their attendance history is kept. You can reactivate them later.</p>
      </ConfirmDialog>
    )
  }

  if (action === 'reactivate') {
    return (
      <ConfirmDialog
        open
        title="Reactivate employee?"
        confirmLabel="Reactivate"
        busy={busy}
        error={error}
        onConfirm={confirm}
        onClose={close}
      >
        <p>
          <strong>{name}</strong> will be able to log in and check in again.
        </p>
      </ConfirmDialog>
    )
  }

  if (action === 'delete') {
    return (
      <ConfirmDialog
        open
        title="Delete employee permanently?"
        confirmLabel="Delete permanently"
        danger
        busy={busy}
        error={error}
        onConfirm={confirm}
        onClose={close}
      >
        <p>
          <strong>{name}</strong> ({employee.employeeCode}) and their login account
          will be removed. <strong>This cannot be undone.</strong>
        </p>
        <p>
          This is only allowed for employees without attendance records, e.g. an
          account that was created by mistake.
        </p>
      </ConfirmDialog>
    )
  }

  return null
}
