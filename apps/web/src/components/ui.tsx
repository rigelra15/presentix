// Small reusable UI pieces used by many pages.
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react'
import { formatTime } from '../lib/format'

export function PageHeader({
  title,
  description,
  actions
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Alert({
  type,
  children
}: {
  type: 'error' | 'success'
  children: ReactNode
}) {
  const Icon = type === 'error' ? AlertCircle : CheckCircle2

  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={18} />
      <span>{children}</span>
    </div>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge ${active ? 'badge-success' : 'badge-muted'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon
}: {
  label: string
  value: number | string
  hint?: string
  icon: ReactNode
}) {
  return (
    <div className="card stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        {hint && <small className="stat-hint">{hint}</small>}
      </div>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <Inbox size={28} />
      <p>{message}</p>
    </div>
  )
}

export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {text}
    </div>
  )
}

// Check-in time with the check-out time below it, for tables
export function WorkHours({
  checkedInAt,
  checkedOutAt
}: {
  checkedInAt: string
  checkedOutAt: string | null
}) {
  return (
    <span className="work-hours">
      <span>In {formatTime(checkedInAt)}</span>
      <small className="muted">
        {checkedOutAt ? `Out ${formatTime(checkedOutAt)}` : 'Not checked out'}
      </small>
    </span>
  )
}
