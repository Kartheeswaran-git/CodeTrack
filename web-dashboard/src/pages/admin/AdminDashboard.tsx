import { Activity, Building2, CheckCircle2, Database, GitCommit, GraduationCap, RefreshCw, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminData } from "@/lib/admin-data"

const AdminDashboard = () => {
  const { students, staff, departments, loading, error, lastUpdated, refresh } = useAdminData()
  const leetcodeSolved = students.reduce((sum, student) => sum + (student.leetcode ? student.leetcode.easy + student.leetcode.medium + student.leetcode.hard : 0), 0)
  const commits = students.reduce((sum, student) => sum + (student.github?.commits ?? 0), 0)
  const approvedTasks = students.reduce((sum, student) => sum + student.tasks.approved, 0)
  const recentStudents = students.slice(0, 5)

  const stats = [
    { name: "Students", value: students.length.toLocaleString(), detail: "Live student records", icon: GraduationCap },
    { name: "Departments", value: departments.length.toLocaleString(), detail: "Current departments", icon: Building2 },
    { name: "Staff", value: staff.length.toLocaleString(), detail: "Profiles with staff role", icon: UserCog },
    { name: "Approved tasks", value: approvedTasks.toLocaleString(), detail: "Current assignments", icon: CheckCircle2 },
  ]

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600">Live overview</p><h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1><p className="mt-1 text-sm text-zinc-500">Current institution data from Supabase.</p></div><Button onClick={() => void refresh()} disabled={loading} variant="outline" className="gap-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh data</Button></div>
    {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</div>}
    {!error && <div className="flex items-center gap-2 text-xs text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Realtime connected{lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ""}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => { const Icon = stat.icon; return <Card key={stat.name} className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-start justify-between p-5"><div><p className="text-sm font-medium text-zinc-500">{stat.name}</p><p className="mt-2 text-2xl font-bold">{stat.value}</p><p className="mt-1 text-xs text-zinc-500">{stat.detail}</p></div><div className="rounded-xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950"><Icon className="h-5 w-5" /></div></CardContent></Card> })}</div>
    {!loading && !students.length ? <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900"><div className="mb-3 rounded-full bg-zinc-100 p-3 text-zinc-400 dark:bg-zinc-800"><Database className="h-5 w-5" /></div><h2 className="font-semibold">No student data available</h2><p className="mt-1 max-w-md text-sm text-zinc-500">When student records are available through your Supabase access policies, they will appear here automatically.</p></div> : <div className="grid gap-4 xl:grid-cols-3"><Card className="border-zinc-200 shadow-sm dark:border-zinc-800 xl:col-span-2"><CardHeader><CardTitle className="text-base">Coding activity</CardTitle><CardDescription>Totals from synchronized student profiles</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60"><Activity className="mb-3 h-5 w-5 text-violet-600" /><p className="text-2xl font-bold">{leetcodeSolved.toLocaleString()}</p><p className="text-xs text-zinc-500">LeetCode problems solved</p></div><div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60"><GitCommit className="mb-3 h-5 w-5 text-violet-600" /><p className="text-2xl font-bold">{commits.toLocaleString()}</p><p className="text-xs text-zinc-500">GitHub commits</p></div><div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/60"><CheckCircle2 className="mb-3 h-5 w-5 text-violet-600" /><p className="text-2xl font-bold">{approvedTasks.toLocaleString()}</p><p className="text-xs text-zinc-500">Tasks approved</p></div></CardContent></Card><Card className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardHeader><CardTitle className="text-base">Students</CardTitle><CardDescription>Current records</CardDescription></CardHeader><CardContent className="space-y-4">{recentStudents.map((student) => <div key={student.id} className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{student.name ? student.name.split(" ").map((part) => part[0]).slice(0, 2).join("") : "?"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{student.name || student.studentId}</p><p className="truncate text-xs text-zinc-500">{student.department ?? "No department"}</p></div></div>)}</CardContent></Card></div>}
  </div>
}

export default AdminDashboard
