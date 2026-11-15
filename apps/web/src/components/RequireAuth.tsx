import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../lib/api'
import { homePathFor, useAuth } from '../lib/auth-context'

// Route guard: shows the child routes only for a logged-in user with the right role.
export default function RequireAuth({ role }: { role: Role }) {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (session.user.role !== role) {
    return <Navigate to={homePathFor(session.user.role)} replace />
  }

  return <Outlet />
}
