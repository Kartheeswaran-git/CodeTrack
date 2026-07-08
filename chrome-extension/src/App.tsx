import { MemoryRouter, Routes, Route, useNavigate, useLocation } from 'react-router'
import { useState, useEffect } from 'react'
import { LayoutDashboard, User, FileText, Briefcase, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

// Helper to retrieve logged in student info
const getStoredStudent = () => {
  const stored = localStorage.getItem('student')
  return stored ? JSON.parse(stored) : null
}

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const student = getStoredStudent()
    if (student && student.id && student.password) {
      navigate('/dashboard')
    }
  }, [navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (!import.meta.env.VITE_SUPABASE_URL) {
      navigate('/dashboard')
      return;
    }

    const { data: studentData, error: rpcError } = await supabase.rpc('verify_student_login', {
      p_email: email,
      p_password: password
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    if (studentData && studentData.length > 0) {
      // Store student details and password for secure subsequent requests
      const sessionData = {
        ...studentData[0],
        password
      }
      localStorage.setItem('student', JSON.stringify(sessionData))
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ student: sessionData })
      }
      navigate('/dashboard')
    } else {
      setError('Invalid student email or password.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 w-[400px]">
      <Card className="w-full shadow-lg border-0 ring-1 ring-zinc-200 dark:ring-zinc-800">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
            CodeTrack Pro
          </CardTitle>
          <CardDescription>
            Student Login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2 text-left">
              <label className="text-sm font-medium">College Email</label>
              <Input 
                type="email" 
                placeholder="student@college.edu" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 text-left">
              <label className="text-sm font-medium">Password</label>
              <Input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500 font-medium text-left">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate()
  const location = useLocation()
  
  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tasks', icon: FileText, label: 'Tasks' },
    { path: '/profile', icon: User, label: 'Profile' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('student')
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove('student')
    }
    navigate('/login')
  }

  return (
    <div className="w-[400px] h-[550px] bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
      <header className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4">
        <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600">
          CodeTrack Pro
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-500" onClick={handleLogout}>
          <LogOut size={16} />
        </Button>
      </header>
      
      <main className="flex-1 overflow-auto p-4">
        {children}
      </main>

      <nav className="h-16 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                isActive 
                  ? 'text-violet-600 dark:text-violet-400' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

const StudentDashboard = () => {
  const [stats, setStats] = useState<{
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
    commits: number;
    repositories: number;
    pending_tasks: number;
    placement_score: number;
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      const student = getStoredStudent()
      if (!student) return
      
      const { data, error } = await supabase.rpc('get_student_dashboard_stats', {
        p_student_id: student.id,
        p_password: student.password
      })

      if (error) {
        setError(error.message)
      } else if (data && data.length > 0) {
        setStats(data[0])
      }
      setLoading(false)
    }

    void fetchStats()
  }, [])

  if (loading) return <div className="text-center p-8 text-sm text-zinc-500">Loading dashboard...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-4">Error: {error}</div>

  const placementLevel = stats ? (stats.placement_score >= 80 ? 'Excellent' : stats.placement_score >= 60 ? 'Good' : 'Needs Work') : ''
  const placementColor = stats ? (stats.placement_score >= 80 ? 'text-emerald-500' : stats.placement_score >= 60 ? 'text-amber-500' : 'text-red-500') : ''

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">My Dashboard</h2>
      
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 text-center p-4">
          <p className="text-xs text-zinc-500 font-medium">Placement Score</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">{stats?.placement_score ?? 0}%</p>
          <p className={`text-[10px] font-semibold mt-1 ${placementColor}`}>{placementLevel}</p>
        </Card>
        <Card className="shadow-sm border-zinc-200 dark:border-zinc-800 text-center p-4">
          <p className="text-xs text-zinc-500 font-medium">Pending Tasks</p>
          <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mt-1">{stats?.pending_tasks ?? 0}</p>
          <p className="text-[10px] text-amber-500 mt-1">Check tasks tab</p>
        </Card>
      </div>

      <Card className="shadow-sm border-zinc-200 dark:border-zinc-800">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Coding Statistics</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">LeetCode Solved</p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg">
                <span className="block text-emerald-600 font-bold">{stats?.easy_solved ?? 0}</span>
                <span className="text-[9px] text-zinc-400">Easy</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
                <span className="block text-amber-600 font-bold">{stats?.medium_solved ?? 0}</span>
                <span className="text-[9px] text-zinc-400">Medium</span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded-lg">
                <span className="block text-red-600 font-bold">{stats?.hard_solved ?? 0}</span>
                <span className="text-[9px] text-zinc-400">Hard</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">GitHub Activity</p>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-lg">
                <span className="block text-zinc-700 dark:text-zinc-300 font-bold">{stats?.commits ?? 0}</span>
                <span className="text-[9px] text-zinc-400">Commits</span>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-800/50 p-2 rounded-lg">
                <span className="block text-zinc-700 dark:text-zinc-300 font-bold">{stats?.repositories ?? 0}</span>
                <span className="text-[9px] text-zinc-400">Repositories</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const TasksList = () => {
  const [tasks, setTasks] = useState<{
    assignment_id: string;
    task_id: string;
    title: string;
    description: string;
    difficulty: string;
    points: number;
    due_date: string | null;
    status: string;
    proof_url: string | null;
    remarks: string | null;
  }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedTask, setSelectedTask] = useState<{ task_id: string; title: string } | null>(null)
  const [proofUrl, setProofUrl] = useState("")
  const [remarks, setRemarks] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchTasks = async () => {
    const student = getStoredStudent()
    if (!student) return

    const { data, error } = await supabase.rpc('get_student_tasks', {
      p_student_id: student.id,
      p_password: student.password
    })

    if (error) setError(error.message)
    else setTasks(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void fetchTasks()
  }, [])

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTask) return
    setSubmitting(true)
    
    const student = getStoredStudent()
    if (!student) return

    const { error } = await supabase.rpc('submit_student_task', {
      p_student_id: student.id,
      p_password: student.password,
      p_task_id: selectedTask.task_id,
      p_proof_url: proofUrl.trim(),
      p_remarks: remarks.trim()
    })

    if (error) {
      alert(`Error submitting: ${error.message}`)
    } else {
      setSelectedTask(null)
      setProofUrl("")
      setRemarks("")
      await fetchTasks()
      alert("Task submitted successfully!")
    }
    setSubmitting(false)
  }

  if (loading) return <div className="text-center p-8 text-sm text-zinc-500">Loading tasks...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-4">Error: {error}</div>

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
      case 'submitted': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
      default: return 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
    }
  }

  const diffColor = (diff: string) => {
    switch (diff) {
      case 'Hard': return 'text-red-500'
      case 'Medium': return 'text-amber-500'
      default: return 'text-emerald-500'
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">Tasks</h2>
      
      {tasks.length === 0 ? (
        <p className="text-center text-sm text-zinc-500 p-8">No tasks assigned yet.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.assignment_id} className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                    {task.title.startsWith('http') ? 'LeetCode Assignment' : `LeetCode: #${task.title}`}
                  </h3>
                  <span className={`text-[10px] font-bold ${diffColor(task.difficulty)}`}>{task.difficulty} · {task.points} pts</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${statusColor(task.status)}`}>
                  {task.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-zinc-500 leading-normal">{task.description}</p>
              
              {/* LeetCode problem redirection links */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {task.title.split(',').map(n => n.trim()).filter(Boolean).map((item, index) => {
                  const isUrl = item.startsWith('http://') || item.startsWith('https://');
                  const href = isUrl ? item : `https://leetcode.com/problemset/all/?search=${item}`;
                  let label = `Solve LeetCode #${item}`;
                  if (isUrl) {
                    try {
                      const urlObj = new URL(item);
                      const parts = urlObj.pathname.split('/').filter(Boolean);
                      const slug = parts[parts.indexOf('problems') + 1] || 'Problem';
                      label = `Solve: ${slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
                    } catch (e) {
                      label = "Solve LeetCode Problem";
                    }
                  }
                  return (
                    <a
                      key={index}
                      href={href}
                      onClick={(e) => {
                        e.preventDefault();
                        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                          chrome.tabs.create({ url: href });
                        } else {
                          window.open(href, '_blank');
                        }
                      }}
                      className="text-[10px] bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/20 dark:text-violet-400 dark:hover:bg-violet-900/30 px-2.5 py-1.5 rounded-md border border-violet-100 dark:border-violet-900/30 font-semibold flex items-center gap-1 transition"
                    >
                      {label}
                    </a>
                  )
                })}
              </div>

              {task.due_date && (
                <p className="text-[10px] text-zinc-400 mt-1">Due: {new Date(task.due_date).toLocaleDateString()}</p>
              )}
              
              {task.status === 'pending' || task.status === 'rejected' ? (
                !(task.title.includes('leetcode.com') || /^\d+(,\d+)*$/.test(task.title)) ? (
                  <Button 
                    onClick={() => setSelectedTask({ task_id: task.task_id, title: task.title })} 
                    className="mt-2 w-full text-xs py-1"
                  >
                    Submit Task
                  </Button>
                ) : (
                  <div className="mt-2 text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800 text-center font-medium">
                    ⚡ Auto-syncs when solved on LeetCode
                  </div>
                )
              ) : (
                <div className="mt-2 text-[10px] bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded border border-zinc-100 dark:border-zinc-800">
                  <span className="font-semibold block text-zinc-600 dark:text-zinc-400">Proof link:</span>
                  <a 
                    href={task.proof_url ?? '#'} 
                    onClick={(e) => {
                      e.preventDefault();
                      if (task.proof_url) {
                        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
                          chrome.tabs.create({ url: task.proof_url });
                        } else {
                          window.open(task.proof_url, '_blank');
                        }
                      }
                    }}
                    className="text-violet-600 break-all hover:underline"
                  >
                    {task.proof_url}
                  </a>
                  {task.remarks && (
                    <p className="mt-1 text-zinc-500"><span className="font-semibold">My Remarks:</span> {task.remarks}</p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-sm mb-3 text-zinc-800 dark:text-zinc-100">Submit: {selectedTask.title}</h3>
            <form onSubmit={handleSubmitTask} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-500">Proof Link (GitHub Commit/PR or LeetCode Sub.)</label>
                <Input 
                  required
                  type="url"
                  placeholder="https://github.com/... or https://leetcode.com/..."
                  value={proofUrl}
                  onChange={(e) => setProofUrl(e.target.value)}
                  className="text-xs py-1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-zinc-500">Remarks (Optional)</label>
                <Input 
                  placeholder="Additional remarks..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="text-xs py-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setSelectedTask(null)} className="text-xs py-1">Cancel</Button>
                <Button type="submit" disabled={submitting} className="text-xs py-1">
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
const StudentProfile = () => {
  const [profile, setProfile] = useState<{
    student_id: string;
    name: string;
    email: string;
    department: string | null;
    year: number | null;
    section: string | null;
    phone: string | null;
    github_url: string | null;
    leetcode_url: string | null;
    linkedin_url: string | null;
    portfolio_url: string | null;
  } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  // Password reset states
  const [changingPassword, setChangingPassword] = useState(false)
  const [pwdForm, setPwdForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" })
  const [pwdSaving, setPwdSaving] = useState(false)

  // Resume link states
  const [driveLink, setDriveLink] = useState("")
  const [inputLink, setInputLink] = useState("")
  const [resumeLoading, setResumeLoading] = useState(true)
  const [resumeSaving, setResumeSaving] = useState(false)
  const [editingResume, setEditingResume] = useState(false)

  const [form, setForm] = useState({
    phone: "",
    githubUrl: "",
    leetcodeUrl: "",
    linkedinUrl: "",
    portfolioUrl: ""
  })

  useEffect(() => {
    const fetchProfile = async () => {
      const student = getStoredStudent()
      if (!student) return

      const { data, error } = await supabase.rpc('get_student_profile', {
        p_student_id: student.id,
        p_password: student.password
      })

      if (error) {
        setError(error.message)
      } else if (data && data.length > 0) {
        const p = data[0]
        setProfile(p)
        setForm({
          phone: p.phone || "",
          githubUrl: p.github_url || "",
          leetcodeUrl: p.leetcode_url || "",
          linkedinUrl: p.linkedin_url || "",
          portfolioUrl: p.portfolio_url || ""
        })
      }
      setLoading(false)
    }

    void fetchProfile()
  }, [editing])

  // Fetch resume link
  useEffect(() => {
    const fetchResume = async () => {
      const student = getStoredStudent()
      if (!student) return

      const { data, error } = await supabase.rpc('get_student_resume', {
        p_student_id: student.id,
        p_password: student.password
      })

      if (!error && data && data.length > 0) {
        setDriveLink(data[0].file_url)
        setInputLink(data[0].file_url)
      }
      setResumeLoading(false)
    }

    void fetchResume()
  }, [])

  const handleSaveResumeLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setResumeSaving(true)
    
    const student = getStoredStudent()
    if (!student) return

    const { error } = await supabase.rpc('update_student_resume', {
      p_student_id: student.id,
      p_password: student.password,
      p_file_url: inputLink.trim()
    })

    if (error) {
      alert(`Error saving: ${error.message}`)
    } else {
      setDriveLink(inputLink.trim())
      setEditingResume(false)
      alert("Resume link updated successfully!")
    }
    setResumeSaving(false)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    const student = getStoredStudent()
    if (!student) return

    const { error } = await supabase.rpc('update_student_profile', {
      p_student_id: student.id,
      p_password: student.password,
      p_phone: form.phone.trim(),
      p_github_url: form.githubUrl.trim(),
      p_leetcode_url: form.leetcodeUrl.trim(),
      p_linkedin_url: form.linkedinUrl.trim(),
      p_portfolio_url: form.portfolioUrl.trim()
    })

    if (error) {
      alert(`Error saving: ${error.message}`)
    } else {
      setEditing(false)
      alert("Profile updated successfully!")
    }
    setSaving(false)
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      alert("New password and confirm password do not match.")
      return
    }
    setPwdSaving(true)
    const student = getStoredStudent()
    if (!student) return

    const { error } = await supabase.rpc('update_student_password', {
      p_student_id: student.id,
      p_old_password: pwdForm.oldPassword,
      p_new_password: pwdForm.newPassword
    })

    if (error) {
      alert(`Error updating password: ${error.message}`)
    } else {
      const updatedStudent = {
        ...student,
        password: pwdForm.newPassword
      }
      localStorage.setItem('student', JSON.stringify(updatedStudent))
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ student: updatedStudent })
      }
      setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" })
      setChangingPassword(false)
      alert("Password updated successfully!")
    }
    setPwdSaving(false)
  }

  if (loading) return <div className="text-center p-8 text-sm text-zinc-500">Loading profile...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-4">Error: {error}</div>

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg text-zinc-800 dark:text-zinc-200">My Profile</h2>
      
      {changingPassword ? (
        <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
            <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">Change Password</h3>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">Old Password</label>
              <Input 
                type="password"
                required
                value={pwdForm.oldPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">New Password</label>
              <Input 
                type="password"
                required
                minLength={8}
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">Confirm New Password</label>
              <Input 
                type="password"
                required
                minLength={8}
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setChangingPassword(false)} className="text-xs py-1">Cancel</Button>
              <Button type="submit" disabled={pwdSaving} className="text-xs py-1 bg-violet-600 text-white">
                {pwdSaving ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </Card>
      ) : !editing ? (
        <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 space-y-4 text-xs">
          <div className="space-y-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{profile?.name}</p>
            <p className="text-zinc-400 font-medium">ID: {profile?.student_id}</p>
            <p className="text-zinc-500 font-medium">Email: {profile?.email}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-zinc-600 dark:text-zinc-400">
            <div>
              <span className="font-semibold block text-zinc-400">Department</span>
              <span>{profile?.department ?? "—"}</span>
            </div>
            <div>
              <span className="font-semibold block text-zinc-400">Class</span>
              <span>{profile?.year ? `Year ${profile?.year} · ${profile?.section ?? '—'}` : "—"}</span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <p className="font-semibold text-zinc-400 text-[10px] uppercase tracking-wider">Contact & Social Links</p>
            <div className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <p><span className="font-semibold text-zinc-400">Phone:</span> {profile?.phone ?? "—"}</p>
              <p><span className="font-semibold text-zinc-400">GitHub:</span> {profile?.github_url ? <a href={profile.github_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline break-all">{profile.github_url}</a> : "—"}</p>
              <p><span className="font-semibold text-zinc-400">LeetCode:</span> {profile?.leetcode_url ? <a href={profile.leetcode_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline break-all">{profile.leetcode_url}</a> : "—"}</p>
              <p><span className="font-semibold text-zinc-400">LinkedIn:</span> {profile?.linkedin_url ? <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline break-all">{profile.linkedin_url}</a> : "—"}</p>
              <p><span className="font-semibold text-zinc-400">Portfolio:</span> {profile?.portfolio_url ? <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline break-all">{profile.portfolio_url}</a> : "—"}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setEditing(true)} className="flex-1 text-xs py-1.5">
              Edit Profile Links
            </Button>
            <Button variant="outline" onClick={() => setChangingPassword(true)} className="flex-1 text-xs py-1.5">
              Reset Password
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800">
          <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">Phone Number</label>
              <Input 
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">GitHub URL</label>
              <Input 
                type="url"
                value={form.githubUrl}
                onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">LeetCode URL</label>
              <Input 
                type="url"
                value={form.leetcodeUrl}
                onChange={(e) => setForm({ ...form, leetcodeUrl: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">LinkedIn URL</label>
              <Input 
                type="url"
                value={form.linkedinUrl}
                onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-zinc-500">Portfolio URL</label>
              <Input 
                type="url"
                value={form.portfolioUrl}
                onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
                className="text-xs py-1"
              />
            </div>
            
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" type="button" onClick={() => setEditing(false)} className="text-xs py-1">Cancel</Button>
              <Button type="submit" disabled={saving} className="text-xs py-1">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Resume Link Section */}
      {!resumeLoading && (
        <Card className="p-4 shadow-sm border-zinc-200 dark:border-zinc-800 space-y-3">
          <p className="font-semibold text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Resume Link
          </p>
          
          {!editingResume && driveLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-950/20 p-3 rounded-lg border border-violet-100 dark:border-violet-900/30">
                <div className="overflow-hidden">
                  <p className="text-[10px] text-zinc-500 truncate">{driveLink}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a 
                  href={driveLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex-1 bg-violet-600 text-white text-xs font-semibold py-2 px-3 rounded-md text-center shadow hover:bg-violet-700 transition"
                >
                  Open Resume
                </a>
                <Button 
                  variant="outline" 
                  onClick={() => setEditingResume(true)} 
                  className="text-xs py-2"
                >
                  Edit Link
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveResumeLink} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Google Drive Link</label>
                <Input 
                  required
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={inputLink}
                  onChange={(e) => setInputLink(e.target.value)}
                  className="text-xs py-1.5"
                />
              </div>
              <div className="flex gap-2 justify-end">
                {driveLink && (
                  <Button 
                    variant="outline" 
                    type="button" 
                    onClick={() => {
                      setInputLink(driveLink)
                      setEditingResume(false)
                    }}
                    className="text-xs py-1.5"
                  >
                    Cancel
                  </Button>
                )}
                <Button 
                  type="submit" 
                  disabled={resumeSaving}
                  className="text-xs py-1.5"
                >
                  {resumeSaving ? "Saving..." : "Save Link"}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </div>
  )
}

const App = () => {
  useEffect(() => {
    const student = getStoredStudent()
    if (student && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ student })
    }
  }, [])

  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        
        <Route path="/dashboard" element={<MainLayout><StudentDashboard /></MainLayout>} />
        <Route path="/tasks" element={<MainLayout><TasksList /></MainLayout>} />

        <Route path="/profile" element={<MainLayout><StudentProfile /></MainLayout>} />
      </Routes>
    </MemoryRouter>
  )
}

export default App
