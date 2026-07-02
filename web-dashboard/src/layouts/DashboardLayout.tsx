import { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router'
import { LayoutDashboard, Users, UserCog, Settings, LogOut, FileText, BarChart3, Bell, Menu, X, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import StaffNotificationCenter from '@/components/StaffNotificationCenter'

interface DashboardLayoutProps {
  role: 'admin' | 'staff'
}

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Password Reset Modal states
  const [resetOpen, setResetOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const adminLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Departments', path: '/admin/departments', icon: Building2 },
    { name: 'Staff Management', path: '/admin/staff', icon: UserCog },
    { name: 'Student Management', path: '/admin/students', icon: Users },
    { name: 'Reports', path: '/admin/reports', icon: FileText },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ]

  const staffLinks = [
    { name: 'Dashboard', path: '/staff', icon: LayoutDashboard },
    { name: 'Students', path: '/staff/students', icon: Users },
    { name: 'Tasks', path: '/staff/tasks', icon: FileText },
    { name: 'Submissions', path: '/staff/submissions', icon: FileText },
    { name: 'Leaderboard', path: '/staff/leaderboard', icon: BarChart3 },
  ]

  const links = role === 'admin' ? adminLinks : staffLinks
  const currentTitle = location.pathname.startsWith('/staff/students/')
    ? 'Student activity profile'
    : links.find((link) => link.path === location.pathname)?.name ?? 'Dashboard'

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setError("New password and confirm password do not match.")
      return
    }

    setSaving(true)

    try {
      if (role === 'admin') {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !user.email) throw new Error("Could not find authenticated admin user.")

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: pwdForm.oldPassword
        })
        if (signInErr) throw new Error("Incorrect old password.")

        const { error: updateErr } = await supabase.auth.updateUser({
          password: pwdForm.newPassword
        })
        if (updateErr) throw new Error(updateErr.message)
      } else {
        const stored = localStorage.getItem('staff')
        const staff = stored ? JSON.parse(stored) : null
        if (!staff) throw new Error("Staff session not found. Please log in again.")

        const { error: rpcErr } = await supabase.rpc('update_staff_password', {
          p_staff_id: staff.id,
          p_old_password: pwdForm.oldPassword,
          p_new_password: pwdForm.newPassword
        })
        if (rpcErr) throw new Error(rpcErr.message)

        localStorage.setItem('staff', JSON.stringify({
          ...staff,
          password: pwdForm.newPassword
        }))
      }

      setSuccess("Password updated successfully!")
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" })
      setTimeout(() => setResetOpen(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-zinc-950/45 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-300 dark:border-zinc-800 dark:bg-zinc-900 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-black text-white">C</div>
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-lg font-bold text-transparent">CodeTrack Pro</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 lg:hidden" aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.path
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-100 font-medium' 
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon size={18} />
                {link.name}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
          <button onClick={() => { setResetOpen(true); setError(null); setSuccess(null); }} className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 transition-colors">
            <Settings size={18} />
            Reset Password
          </button>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50 transition-colors">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1 flex flex-col overflow-hidden">
        <header className="h-16 shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <div>
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{currentTitle}</h2>
              <p className="hidden text-xs text-zinc-400 sm:block">{role === 'admin' ? 'Admin' : 'Staff'} workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {role === 'staff' ? <StaffNotificationCenter /> : <button className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Notifications"><Bell className="h-4 w-4" /></button>}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold text-sm">{role === 'admin' ? 'A' : 'S'}</div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold">{role === 'admin' ? 'Administrator' : 'Staff member'}</p>
                <p className="text-[11px] text-zinc-400">{role === 'admin' ? 'Institution admin' : 'Faculty'}</p>
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Reset Password Modal */}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl text-zinc-900 dark:text-zinc-100">
            <h3 className="font-bold text-lg mb-2">Reset Password</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-4">Please type your current password and your new password to verify.</p>

            {error && <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 text-xs font-semibold">{error}</div>}
            {success && <div className="p-3 mb-4 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs font-semibold">{success}</div>}

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-500">Current Password</label>
                <input 
                  type="password"
                  required
                  value={pwdForm.oldPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-zinc-500">New Password</label>
                <input 
                  type="password"
                  required
                  minLength={8}
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-zinc-500">Confirm New Password</label>
                <input 
                  type="password"
                  required
                  minLength={8}
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setResetOpen(false); setError(null); setSuccess(null); }}
                  className="px-4 h-9 rounded-md border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-4 h-9 rounded-md bg-violet-600 hover:bg-violet-700 text-white font-semibold disabled:opacity-50"
                >
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardLayout;
