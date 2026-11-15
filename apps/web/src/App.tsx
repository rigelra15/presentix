import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathFor, useAuth } from './lib/auth-context'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import CheckInPage from './pages/employee/CheckInPage'
import HistoryPage from './pages/employee/HistoryPage'
import OverviewPage from './pages/hrd/OverviewPage'
import EmployeesPage from './pages/hrd/EmployeesPage'
import EmployeeFormPage from './pages/hrd/EmployeeFormPage'
import AttendancePage from './pages/hrd/AttendancePage'
import AttendanceDetailPage from './pages/hrd/AttendanceDetailPage'

export default function App() {
  const { session } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* "/" sends the user to the right home page */}
      <Route
        path="/"
        element={
          <Navigate to={session ? homePathFor(session.user.role) : '/login'} replace />
        }
      />

      {/* Employee pages */}
      <Route element={<RequireAuth role="EMPLOYEE" />}>
        <Route element={<Layout />}>
          <Route path="/check-in" element={<CheckInPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<AttendanceDetailPage />} />
        </Route>
      </Route>

      {/* HRD pages */}
      <Route element={<RequireAuth role="HRD" />}>
        <Route element={<Layout />}>
          <Route path="/hrd" element={<OverviewPage />} />
          <Route path="/hrd/employees" element={<EmployeesPage />} />
          <Route path="/hrd/employees/new" element={<EmployeeFormPage />} />
          <Route path="/hrd/employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="/hrd/attendance" element={<AttendancePage />} />
          <Route path="/hrd/attendance/:id" element={<AttendanceDetailPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
