import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, CheckCircle, Clock, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Link } from "react-router"

type DashboardStats = {
  assigned_students: number
  active_tasks: number
  pending_verifications: number
  tasks_approved: number
}

type RecentSubmission = {
  submission_id: string
  student_name: string
  task_title: string
  proof_url: string
  submitted_at: string
  status: string
  remarks: string | null
  difficulty: string
  points: number
}

type StudentProgress = {
  student_uuid: string
  student_id: string
  name: string
  email: string
  solved_easy: number
  solved_medium: number
  solved_hard: number
  commits: number
  repositories: number
  approved_points: number
}

const getStoredStaff = () => {
  const stored = localStorage.getItem('staff')
  return stored ? JSON.parse(stored) : null
}

const StaffDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [submissions, setSubmissions] = useState<RecentSubmission[]>([])
  const [progress, setProgress] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      const staff = getStoredStaff()
      if (!staff) {
        setError("No staff session found.")
        setLoading(false)
        return
      }

      const [statsRes, subsRes, progRes] = await Promise.all([
        supabase.rpc('get_staff_dashboard_stats', { p_staff_id: staff.id, p_password: staff.password }),
        supabase.rpc('get_staff_recent_submissions', { p_staff_id: staff.id, p_password: staff.password }),
        supabase.rpc('get_staff_assigned_students_progress', { p_staff_id: staff.id, p_password: staff.password })
      ])

      const firstErr = statsRes.error || subsRes.error || progRes.error
      if (firstErr) {
        setError(firstErr.message)
      } else {
        setStats(statsRes.data?.[0] || null)
        setSubmissions(subsRes.data || [])
        setProgress(progRes.data || [])
      }
      setLoading(false)
    }

    void fetchDashboardData()
  }, [])

  if (loading) return <div className="text-center p-12 text-sm text-zinc-500">Loading dashboard...</div>
  if (error) return <div className="text-red-500 text-sm text-center p-12 bg-red-50 rounded-xl border border-red-200">Error: {error}</div>

  const statsItems = [
    { name: "My Students", value: stats?.assigned_students ?? 0, icon: Users },
    { name: "Active Tasks", value: stats?.active_tasks ?? 0, icon: FileText },
    { name: "Pending Verifications", value: stats?.pending_verifications ?? 0, icon: Clock },
    { name: "Tasks Approved", value: stats?.tasks_approved ?? 0, icon: CheckCircle },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsItems.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.name} className="shadow-sm border-zinc-200 dark:border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  {stat.name}
                </CardTitle>
                <Icon className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Submissions */}
        <Card className="col-span-4 shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base font-bold">Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-8">No submissions found.</p>
            ) : (
              <div className="space-y-4">
                {submissions.slice(0, 5).map((sub) => (
                  <div key={sub.submission_id} className="flex items-center justify-between p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg">
                    <div className="overflow-hidden pr-2">
                      <p className="font-semibold text-sm truncate">{sub.task_title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Submitted by {sub.student_name}</p>
                      <a href={sub.proof_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-violet-600 dark:text-violet-400 mt-1 inline-flex items-center gap-1 hover:underline truncate max-w-xs">
                        View Proof <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 ${
                      sub.status === 'approved' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : sub.status === 'rejected'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>
                      {sub.status.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Progress */}
        <Card className="col-span-3 shadow-sm border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base font-bold">Student Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.length === 0 ? (
              <p className="text-center text-sm text-zinc-500 py-8">No assigned students.</p>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-auto">
                {progress.map((student) => (
                  <Link to={`/staff/students/${student.student_uuid}`} key={student.student_uuid} className="flex items-center justify-between rounded-lg border-b border-zinc-100 p-2 pb-3 text-xs transition hover:bg-violet-50/70 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-zinc-800 dark:hover:bg-violet-950/20">
                    <div>
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">{student.name}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">ID: {student.student_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-violet-600 dark:text-violet-400">{student.approved_points} pts</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">LC: {student.solved_easy + student.solved_medium + student.solved_hard} | GH: {student.commits}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default StaffDashboard
