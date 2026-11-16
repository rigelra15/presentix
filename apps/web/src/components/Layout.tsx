import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Camera,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X
} from 'lucide-react'
import { useSession, useAuth } from '../lib/auth-context'

const hrdMenu = [
  { to: '/hrd', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/hrd/employees', label: 'Employees', icon: Users, end: false },
  { to: '/hrd/attendance', label: 'Attendance', icon: ClipboardList, end: false },
  { to: '/account', label: 'Account', icon: KeyRound, end: true }
]

const employeeMenu = [
  { to: '/check-in', label: 'Check-in', icon: Camera, end: true },
  { to: '/history', label: 'My History', icon: History, end: true },
  { to: '/account', label: 'Account', icon: KeyRound, end: true }
]

export default function Layout() {
  const { user } = useSession()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const menu = user.role === 'HRD' ? hrdMenu : employeeMenu

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">W</span>
          <div>
            <strong>WFH Attendance</strong>
            <small>{user.role === 'HRD' ? 'HRD Portal' : 'Employee Portal'}</small>
          </div>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {menu.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="nav-link"
              onClick={() => setMenuOpen(false)}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{user.email[0].toUpperCase()}</span>
            <div>
              <strong>{user.email}</strong>
              <small>{user.role === 'HRD' ? 'HR Department' : 'Employee'}</small>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {menuOpen && (
        <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      <div className="main-area">
        <header className="mobile-topbar">
          <button
            type="button"
            className="icon-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <strong>WFH Attendance</strong>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
