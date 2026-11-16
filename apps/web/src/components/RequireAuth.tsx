import { Navigate, Outlet } from 'react-router-dom'
import type { Role } from '../lib/api'
import { homePathFor, useAuth } from '../lib/auth-context'

// Route guard: shows the child routes only for a logged-in user.
// With a role, only for users with that role.
export default function RequireAuth({ role }: { role?: Role }) {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (role && session.user.role !== role) {
    return <Navigate to={homePathFor(session.user.role)} replace />
  }

  return <Outlet />
}
