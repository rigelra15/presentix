import { useEffect, useRef, type ReactNode } from 'react'
import { CircleHelp, TriangleAlert } from 'lucide-react'
import { Alert } from './ui'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  // danger = red button, for actions that are hard to undo
  danger?: boolean
  // true while the request is running
  busy?: boolean
  error?: string
  onConfirm: () => void
  onClose: () => void
}

// Confirmation modal built on the native <dialog> element.
// showModal() already gives us the dark backdrop, Escape to close
// and keeps keyboard focus inside the dialog.
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onClose
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function close() {
    // Do not close while the request is still running
    if (!busy) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={event => {
        // Escape key: let React state decide if the dialog closes
        event.preventDefault()
        close()
      }}
      onClick={event => {
        // A click on the dark backdrop lands on the <dialog> itself
        if (event.target === dialogRef.current) close()
      }}
    >
      <div className="modal-content">
        <div className={`modal-icon ${danger ? 'modal-icon-danger' : ''}`}>
          {danger ? <TriangleAlert size={22} /> : <CircleHelp size={22} />}
        </div>

        <div className="modal-text">
          <h2 id="modal-title">{title}</h2>
          <div className="modal-message">{children}</div>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <div className="modal-actions">
          {/* Cancel gets focus first, so pressing Enter does not confirm by accident */}
          <button type="button" className="btn btn-secondary" onClick={close} disabled={busy} autoFocus>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
