import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import Login from './pages/Login'
import DashboardLayout from './layouts/DashboardLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import StaffDashboard from './pages/staff/StaffDashboard'
import StaffTasksPage from './pages/staff/StaffTasksPage'
import SubmissionsVerificationPage from './pages/staff/SubmissionsVerificationPage'
import LeaderboardPage from './pages/staff/LeaderboardPage'
import StudentDetailPage from './pages/staff/StudentDetailPage'
import { AdminDataProvider } from './lib/admin-data'
import {
  AnalyticsPage,
  ReportsPage,
  SettingsPage,
} from './pages/admin/RealtimeAdminPages'
import { DepartmentManagementPage, StaffManagementPage, StudentManagementPage } from './pages/management/UserManagementPages'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDataProvider><DashboardLayout role="admin" /></AdminDataProvider>}>
          <Route index element={<AdminDashboard />} />
          <Route path="departments" element={<DepartmentManagementPage />} />
          <Route path="staff" element={<StaffManagementPage />} />
          <Route path="students" element={<StudentManagementPage actorRole="admin" />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Staff Routes */}
        <Route path="/staff" element={<AdminDataProvider><DashboardLayout role="staff" /></AdminDataProvider>}>
          <Route index element={<StaffDashboard />} />
          <Route path="students" element={<StudentManagementPage actorRole="staff" />} />
          <Route path="students/:studentId" element={<StudentDetailPage />} />
          <Route path="tasks" element={<StaffTasksPage />} />
          <Route path="submissions" element={<SubmissionsVerificationPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
