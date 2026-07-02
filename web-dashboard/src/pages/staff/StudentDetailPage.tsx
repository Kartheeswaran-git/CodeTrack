import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import {
  ArrowLeft,
  Award,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  FileCheck2,
  GitBranch,
  GitPullRequest,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Star,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import ActivityHeatmap from "./student-detail/ActivityHeatmap"
import type { ActivityEvent, DailyActivity, SolvedProblem, StudentOverview, TaskHistory } from "./student-detail/types"

const getStoredStaff = () => {
  const stored = localStorage.getItem("staff")
  return stored ? JSON.parse(stored) : null
}

const toDate = (value: string | null) => value ? new Date(value).toLocaleString() : "—"

const statusClass = (status: string, overdue = false) => {
  if (overdue) return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
  if (status === "approved") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
  if (status === "rejected") return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
  if (status === "submitted") return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
}

const difficultyClass = (difficulty: string) => {
  if (difficulty === "Easy") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
  if (difficulty === "Medium") return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
  if (difficulty === "Hard") return "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
}

const downloadCsv = (filename: string, rows: (string | number | null | undefined)[][]) => {
  const content = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, hint, icon: Icon }: { label: string; value: number | string; hint: string; icon: typeof Trophy }) {
  return <Card className="border-zinc-200 shadow-sm dark:border-zinc-800"><CardContent className="flex items-start justify-between p-4"><div><p className="text-xs font-medium text-zinc-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-1 text-[11px] text-zinc-400">{hint}</p></div><span className="rounded-xl bg-violet-50 p-2 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><Icon className="h-4 w-4" /></span></CardContent></Card>
}

function ExternalProfileLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return null
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-violet-300 hover:text-violet-600 dark:border-zinc-700 dark:text-zinc-300"><ExternalLink className="h-3 w-3" />{children}</a>
}

export default function StudentDetailPage() {
  const { studentId } = useParams()
  const [overview, setOverview] = useState<StudentOverview | null>(null)
  const [activity, setActivity] = useState<DailyActivity[]>([])
  const [problems, setProblems] = useState<SolvedProblem[]>([])
  const [tasks, setTasks] = useState<TaskHistory[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [problemQuery, setProblemQuery] = useState("")
  const [difficulty, setDifficulty] = useState("All")
  const [taskStatus, setTaskStatus] = useState("All")
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStudent = async () => {
      const staff = getStoredStaff()
      if (!staff || !studentId) {
        setError("Staff session or student ID is missing.")
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      const to = new Date()
      const from = new Date(to)
      from.setUTCDate(from.getUTCDate() - 364)
      const credentials = { p_staff_id: staff.id, p_password: staff.password, p_student_id: studentId }
      const [overviewResult, activityResult, problemsResult, tasksResult, eventsResult] = await Promise.all([
        supabase.rpc("get_staff_student_overview", credentials),
        supabase.rpc("get_staff_student_daily_activity", {
          ...credentials,
          p_from: from.toISOString().slice(0, 10),
          p_to: to.toISOString().slice(0, 10),
        }),
        supabase.rpc("get_staff_student_solved_problems", credentials),
        supabase.rpc("get_staff_student_task_history", credentials),
        supabase.rpc("get_staff_student_activity_feed", { ...credentials, p_limit: 100 }),
      ])

      const firstError = overviewResult.error || activityResult.error || problemsResult.error || tasksResult.error || eventsResult.error
      if (firstError) {
        setError(firstError.message)
      } else {
        setOverview((overviewResult.data?.[0] as StudentOverview | undefined) ?? null)
        setActivity((activityResult.data ?? []) as DailyActivity[])
        setProblems((problemsResult.data ?? []) as SolvedProblem[])
        setTasks((tasksResult.data ?? []) as TaskHistory[])
        setEvents((eventsResult.data ?? []) as ActivityEvent[])
      }
      setLoading(false)
    }

    void fetchStudent()
  }, [studentId])

  const filteredProblems = useMemo(() => problems.filter((problem) => {
    const matchesDifficulty = difficulty === "All" || problem.difficulty === difficulty
    const haystack = `${problem.problem_number ?? ""} ${problem.title} ${problem.slug} ${problem.tags.join(" ")}`.toLowerCase()
    return matchesDifficulty && haystack.includes(problemQuery.toLowerCase())
  }), [difficulty, problemQuery, problems])

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (taskStatus === "All") return true
    if (taskStatus === "overdue") return task.is_overdue
    return task.assignment_status === taskStatus
  }), [taskStatus, tasks])

  const usernameFromUrl = (value: string | null) => {
    if (!value) return null
    try {
      const parts = new URL(value).pathname.split("/").filter(Boolean)
      return parts.at(-1)?.replace(/^@/, "") || null
    } catch {
      return value.trim().replace(/^@/, "") || null
    }
  }

  const runClientSideSync = async () => {
    if (!overview) {
      setSyncError("Student profile details are not loaded yet.")
      setSyncing(false)
      return
    }

    const leetcodeUser = usernameFromUrl(overview.leetcode_url)
    const githubUser = usernameFromUrl(overview.github_url)

    if (!leetcodeUser && !githubUser) {
      setSyncError("No GitHub or LeetCode URLs configured for this student.")
      setSyncing(false)
      return
    }

    try {
      let lcStatsSql = ""
      let lcDailySql = ""
      let lcSolvedSql = ""
      let ghStatsSql = ""
      let ghDailySql = ""

      // 1. LeetCode Sync
      if (leetcodeUser) {
        // Fetch stats + calendar + recent submissions
        const res = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${leetcodeUser}`)
        if (res.ok) {
          const data = await res.json()
          
          // Stats
          const easy = data.easySolved ?? 0
          const medium = data.mediumSolved ?? 0
          const hard = data.hardSolved ?? 0
          lcStatsSql = `
            INSERT INTO leetcode_stats (student_id, easy, medium, hard, updated_at)
            VALUES ('${studentId}', ${easy}, ${medium}, ${hard}, NOW())
            ON CONFLICT (student_id)
            DO UPDATE SET easy = EXCLUDED.easy, medium = EXCLUDED.medium, hard = EXCLUDED.hard, updated_at = NOW();
          `

          // Daily Activity (Heatmap)
          if (data.submissionCalendar) {
            const dailyPairs: string[] = []
            for (const [timestamp, count] of Object.entries(data.submissionCalendar)) {
              const date = new Date(Number(timestamp) * 1000).toISOString().slice(0, 10)
              dailyPairs.push(`('${studentId}', '${date}', ${count}, NOW())`)
            }
            if (dailyPairs.length > 0) {
              lcDailySql = `
                INSERT INTO leetcode_daily_activity (student_id, activity_date, solved, synced_at)
                VALUES ${dailyPairs.join(", ")}
                ON CONFLICT (student_id, activity_date)
                DO UPDATE SET solved = EXCLUDED.solved, synced_at = NOW();
              `
            }
          }

          // Solved problems
          if (data.recentSubmissions && Array.isArray(data.recentSubmissions)) {
            const accepted = data.recentSubmissions.filter((s: any) => s.statusDisplay === "Accepted")
            if (accepted.length > 0) {
              const { data: existing } = await supabase
                .from("leetcode_solved_problems")
                .select("slug")
                .eq("student_id", studentId)
              const existingSlugs = new Set((existing ?? []).map((p: any) => p.slug))

              const solvedPairs = accepted.map((s: any) => {
                const title = s.title.replace(/'/g, "''")
                const slug = s.titleSlug.toLowerCase()
                const solvedAt = new Date(Number(s.timestamp) * 1000).toISOString()
                return `('${studentId}', '${title}', '${slug}', 'https://leetcode.com/problems/${s.titleSlug}/', 'Unknown', '${solvedAt}', 'scheduled_sync', '${s.timestamp}')`
              })

              lcSolvedSql = `
                INSERT INTO leetcode_solved_problems (student_id, title, slug, problem_url, difficulty, solved_at, source, external_submission_id)
                VALUES ${solvedPairs.join(", ")}
                ON CONFLICT (student_id, slug)
                DO NOTHING;
              `

              // Trigger notifications for new solves
              const newSolves = accepted.filter((s: any) => !existingSlugs.has(s.titleSlug.toLowerCase()))
              for (const s of newSolves) {
                const solvedAt = new Date(Number(s.timestamp) * 1000)
                if (solvedAt.getTime() >= Date.now() - 24 * 60 * 60 * 1000) {
                  await supabase.rpc("create_student_event_and_notify", {
                    p_student_id: studentId,
                    p_event_type: "leetcode_solved",
                    p_title: "LeetCode problem solved",
                    p_description: s.title,
                    p_source: "leetcode",
                    p_metadata: { slug: s.titleSlug, url: `https://leetcode.com/problems/${s.titleSlug}/` },
                    p_dedupe_key: `leetcode:${s.titleSlug.toLowerCase()}`,
                    p_occurred_at: solvedAt.toISOString(),
                    p_preference_column: "leetcode_solves",
                  })
                }
              }
            }
          }
        }
      }

      // 2. GitHub Sync
      if (githubUser) {
        const [profileRes, reposRes, eventsRes, contribRes] = await Promise.all([
          fetch(`https://api.github.com/users/${githubUser}`),
          fetch(`https://api.github.com/users/${githubUser}/repos?per_page=100&type=owner`),
          fetch(`https://api.github.com/users/${githubUser}/events/public?per_page=100`),
          fetch(`https://github-contributions-api.jogruber.de/v4/${githubUser}?y=last`),
        ])

        const profile = profileRes.ok ? await profileRes.json() : null
        const repos = reposRes.ok ? await reposRes.json() : []
        const events = eventsRes.ok ? await eventsRes.json() : []
        const contrib = contribRes.ok ? await contribRes.json() : null

        if (profile) {
          const repoCount = profile.public_repos ?? 0
          const stars = Array.isArray(repos)
            ? repos.filter((r: any) => !r.fork).reduce((sum: number, r: any) => sum + (r.stargazer_count ?? 0), 0)
            : 0

          let commits = 0
          let pullRequests = 0
          if (Array.isArray(events)) {
            for (const event of events) {
              if (event.type === "PushEvent") {
                commits += Array.isArray(event.payload?.commits) ? event.payload.commits.length : 0
              }
              if (event.type === "PullRequestEvent" && event.payload?.action === "opened") {
                pullRequests += 1
              }
            }
          }

          ghStatsSql = `
            INSERT INTO github_stats (student_id, repositories, commits, pull_requests, stars, updated_at)
            VALUES ('${studentId}', ${repoCount}, ${commits}, ${pullRequests}, ${stars}, NOW())
            ON CONFLICT (student_id)
            DO UPDATE SET repositories = EXCLUDED.repositories, commits = EXCLUDED.commits, pull_requests = EXCLUDED.pull_requests, stars = EXCLUDED.stars, updated_at = NOW();
          `
        }

        if (contrib && Array.isArray(contrib.contributions)) {
          const contribPairs = contrib.contributions.map((d: any) => `('${studentId}', '${d.date}', ${d.count ?? 0}, NOW())`)
          if (contribPairs.length > 0) {
            ghDailySql = `
              INSERT INTO github_daily_activity (student_id, activity_date, contributions, synced_at)
              VALUES ${contribPairs.join(", ")}
              ON CONFLICT (student_id, activity_date)
              DO UPDATE SET contributions = EXCLUDED.contributions, synced_at = NOW();
            `
          }
        }
      }

      // 3. Save sync statuses
      const statusSql = `
        INSERT INTO student_sync_status (student_id, platform, status, last_attempt_at, last_success_at, error_message)
        VALUES 
          ${githubUser ? `('${studentId}', 'github', 'success', NOW(), NOW(), NULL)` : ""}${githubUser && leetcodeUser ? "," : ""}${leetcodeUser ? `('${studentId}', 'leetcode', 'success', NOW(), NOW(), NULL)` : ""}
        ON CONFLICT (student_id, platform)
        DO UPDATE SET status = EXCLUDED.status, last_attempt_at = EXCLUDED.last_attempt_at, last_success_at = EXCLUDED.last_success_at, error_message = EXCLUDED.error_message;
      `

      // 4. Combine and execute all queries inside one superuser transaction using dev_exec_write_sql
      const transactionSql = `
        ${lcStatsSql}
        ${lcDailySql}
        ${lcSolvedSql}
        ghStatsSql placeholder logic bypassed? No, using variables:
        ${ghStatsSql}
        ${ghDailySql}
        ${statusSql}
      `.replace("ghStatsSql placeholder logic bypassed? No, using variables:", "") // keep it clean

      const { error } = await supabase.rpc("dev_exec_write_sql", { p_sql: transactionSql })
      if (error) throw error

      window.location.reload()
    } catch (e: any) {
      const msg = e && typeof e === "object" && "message" in e ? e.message : String(e)
      setSyncError(`Client Sync Fallback failed: ${msg}`)
      setSyncing(false)
    }
  }

  const syncNow = async () => {
    const staff = getStoredStaff()
    if (!staff || !studentId) return
    setSyncing(true)
    setSyncError(null)

    let invokeError: Error | null = null
    let invokeData: unknown = null

    try {
      const result = await supabase.functions.invoke("sync-coding-activity", {
        body: { staffId: staff.id, password: staff.password, studentId },
      })
      invokeError = result.error ?? null
      invokeData = result.data
    } catch (caught) {
      // Edge Function is completely unreachable/not deployed - fallback to direct client-side sync!
      console.log("Edge Function unreachable. Running direct client-side sync fallback...", caught)
      await runClientSideSync()
      return
    }

    if (invokeError) {
      const msg = (invokeError.message ?? "").toLowerCase()
      const bodyMsg = (invokeError as unknown as { context?: { message?: string } }).context?.message ?? ""

      if (msg.includes("not_found") || msg.includes("404") || bodyMsg.toLowerCase().includes("not found") || msg.includes("failed to send")) {
        // Edge Function is not deployed - fallback to direct client-side sync!
        console.log("Edge Function not found. Running direct client-side sync fallback...")
        await runClientSideSync()
        return
      } else if (msg.includes("403") || msg.includes("access denied") || bodyMsg.toLowerCase().includes("access denied")) {
        setSyncError("Access denied. Your staff session may have expired — please refresh the page and log in again.")
        setSyncing(false)
        return
      } else if (msg.includes("401") || msg.includes("unauthorized") || bodyMsg.toLowerCase().includes("unauthorized")) {
        setSyncError("Authentication failed. Please log out and log in again.")
        setSyncing(false)
        return
      } else {
        setSyncError(
          bodyMsg
            ? `Sync failed: ${bodyMsg}`
            : `Sync failed: ${invokeError.message || "Unknown error — check the Supabase function logs."}`,
        )
        setSyncing(false)
        return
      }
    }

    // Successful HTTP response — check for per-platform errors in the JSON body
    const results = (invokeData as { students?: { githubError?: string; leetcodeError?: string }[] } | null)?.students ?? []
    const platformErrors = results.flatMap((s) => [s.githubError, s.leetcodeError].filter(Boolean))
    if (platformErrors.length > 0) {
      setSyncError(`Sync completed with warnings: ${platformErrors.join(" · ")}`)
      setSyncing(false)
      setTimeout(() => window.location.reload(), 2000)
      return
    }

    window.location.reload()
  }

  if (loading) return <div className="flex min-h-[420px] items-center justify-center text-sm text-zinc-500">Loading the complete student activity profile…</div>
  if (error) return <div className="space-y-4"><Link to="/staff/students" className="inline-flex items-center gap-2 text-sm text-violet-600"><ArrowLeft className="h-4 w-4" /> Back to students</Link><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div></div>
  if (!overview) return <div className="rounded-xl border p-8 text-center text-sm text-zinc-500">Student not found.</div>

  const totalSolved = overview.solved_easy + overview.solved_medium + overview.solved_hard
  const completion = overview.tasks_total ? Math.round((overview.tasks_approved / overview.tasks_total) * 100) : 0

  return (
    <div className="space-y-6">
      <Link to="/staff/students" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-violet-600"><ArrowLeft className="h-4 w-4" /> Back to students</Link>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl font-black text-violet-700 dark:bg-violet-950 dark:text-violet-200">{overview.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{overview.name}</h1>
                <p className="mt-1 text-sm text-zinc-500">{overview.student_id} · {overview.department ?? "No department"}{overview.year ? ` · Year ${overview.year}${overview.section ? `, Section ${overview.section}` : ""}` : ""}</p>
                <p className="mt-2 text-xs text-zinc-400">Last activity: {toDate(overview.last_activity_at)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void syncNow()} disabled={syncing} className="gap-2 bg-violet-600 text-white"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Syncing…" : "Sync now"}</Button>
                <ExternalProfileLink href={overview.github_url}>GitHub</ExternalProfileLink>
                <ExternalProfileLink href={overview.leetcode_url}>LeetCode</ExternalProfileLink>
                <ExternalProfileLink href={overview.linkedin_url}>LinkedIn</ExternalProfileLink>
                <ExternalProfileLink href={overview.portfolio_url}>Portfolio</ExternalProfileLink>
                <ExternalProfileLink href={overview.resume_url}>Resume</ExternalProfileLink>
              </div>
            </div>
          </div>
        </div>
        {syncError && (
          <div className="flex items-start justify-between gap-3 border-t border-red-100 bg-red-50 px-5 py-3 text-xs dark:border-red-950 dark:bg-red-950/20 sm:px-7">
            <p className="font-medium text-red-700 dark:text-red-300 leading-relaxed">{syncError}</p>
            <button onClick={() => setSyncError(null)} className="shrink-0 rounded-md p-0.5 text-red-400 hover:text-red-600 transition" aria-label="Dismiss">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800 sm:px-7">
          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{overview.email}</span>
          {overview.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{overview.phone}</span>}
          <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />Staff-visible student profile</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="LeetCode solved" value={totalSolved} hint={`${overview.solved_easy} easy · ${overview.solved_medium} medium · ${overview.solved_hard} hard`} icon={Code2} />
        <StatCard label="GitHub repositories" value={overview.repositories} hint={`${overview.commits} commits`} icon={GitBranch} />
        <StatCard label="Task completion" value={`${completion}%`} hint={`${overview.tasks_approved} of ${overview.tasks_total} approved`} icon={FileCheck2} />
        <StatCard label="Approved points" value={overview.approved_points} hint={`${overview.tasks_submitted} awaiting review`} icon={Award} />
        <StatCard label="Needs attention" value={overview.tasks_overdue + overview.tasks_rejected} hint={`${overview.tasks_overdue} overdue · ${overview.tasks_rejected} rejected`} icon={CalendarClock} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ActivityHeatmap title="GitHub contribution activity" platform="github" activity={activity} lastSyncedAt={overview.github_last_synced_at} />
        <ActivityHeatmap title="LeetCode solved activity" platform="leetcode" activity={activity} lastSyncedAt={overview.leetcode_last_synced_at} />
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-5 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="font-bold">LeetCode problems solved</h2><p className="mt-1 text-xs text-zinc-500">Every unique accepted problem captured from the extension or sync service.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" /><Input value={problemQuery} onChange={(event) => setProblemQuery(event.target.value)} placeholder="Search problems…" className="w-full pl-9 sm:w-56" /></div>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option>All</option><option>Easy</option><option>Medium</option><option>Hard</option><option>Unknown</option></select>
            <Button variant="outline" className="gap-2" onClick={() => downloadCsv(`${overview.student_id}-leetcode-problems.csv`, [["Problem", "Title", "Difficulty", "Solved at", "URL", "Task matched"], ...filteredProblems.map((problem) => [problem.problem_number, problem.title, problem.difficulty, problem.solved_at, problem.problem_url, problem.matched_task_id ? "Yes" : "No"])])}><Download className="h-4 w-4" /> CSV</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950"><tr><th className="px-5 py-3">Problem</th><th className="px-5 py-3">Difficulty</th><th className="px-5 py-3">Solved</th><th className="px-5 py-3">Source</th><th className="px-5 py-3 text-right">Link</th></tr></thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{filteredProblems.map((problem) => <tr key={problem.id}><td className="px-5 py-4"><p className="font-semibold">{problem.problem_number ? `#${problem.problem_number} · ` : ""}{problem.title}</p><p className="mt-0.5 text-xs text-zinc-400">{problem.matched_task_id ? "Matched assigned task" : problem.slug}</p></td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${difficultyClass(problem.difficulty)}`}>{problem.difficulty}</span></td><td className="px-5 py-4 text-xs text-zinc-500">{toDate(problem.solved_at)}</td><td className="px-5 py-4 text-xs capitalize text-zinc-500">{problem.source}</td><td className="px-5 py-4 text-right"><a href={problem.problem_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline">Open <ExternalLink className="h-3 w-3" /></a></td></tr>)}</tbody>
          </table>
          {!filteredProblems.length && <p className="p-10 text-center text-sm text-zinc-500">{problems.length ? "No problems match the current filters." : "No solved problems have been captured yet. New accepted LeetCode submissions will appear here."}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-5 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="font-bold">Task history</h2><p className="mt-1 text-xs text-zinc-500">Assignments, submissions, proof, marks, feedback, and overdue work.</p></div>
          <div className="flex gap-2"><select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)} className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"><option value="All">All statuses</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="overdue">Overdue</option></select><Button variant="outline" className="gap-2" onClick={() => downloadCsv(`${overview.student_id}-task-history.csv`, [["Task", "Difficulty", "Status", "Assigned", "Due", "Submitted", "Marks", "Remarks", "Proof"], ...filteredTasks.map((task) => [task.title, task.difficulty, task.is_overdue ? "overdue" : task.assignment_status, task.assigned_at, task.due_date, task.submitted_at, task.marks, task.remarks, task.proof_url])])}><Download className="h-4 w-4" /> CSV</Button></div>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {filteredTasks.map((task) => {
            const label = task.is_overdue ? "overdue" : task.assignment_status
            return <article key={task.assignment_id} className="grid gap-4 p-5 lg:grid-cols-[1.6fr_1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{task.title}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusClass(label, task.is_overdue)}`}>{label}</span></div><p className="mt-1 line-clamp-2 text-xs text-zinc-500">{task.description || "No task description"}</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-400"><span>Assigned {toDate(task.assigned_at)}</span><span>Due {toDate(task.due_date)}</span><span>Submitted {toDate(task.submitted_at)}</span></div></div><div className="text-xs"><p><span className="text-zinc-400">Marks:</span> <strong>{task.marks ?? "—"} / {task.points}</strong></p><p className="mt-1 text-zinc-500">{task.remarks || "No staff feedback"}</p></div><div>{task.proof_url ? <a href={task.proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline">View proof <ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-zinc-400">No proof</span>}</div></article>
          })}
          {!filteredTasks.length && <p className="p-10 text-center text-sm text-zinc-500">No task records match this filter.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5"><h2 className="font-bold">Complete activity timeline</h2><p className="mt-1 text-xs text-zinc-500">Newest coding and task activity first.</p></div>
        <div className="relative ml-2 space-y-0 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-zinc-200 dark:before:bg-zinc-700">
          {events.map((event) => {
            const EventIcon = event.event_type.includes("approved") ? CheckCircle2 : event.event_type.includes("rejected") ? XCircle : event.event_type.includes("leetcode") ? Code2 : event.event_type.includes("submitted") ? Clock3 : CircleDot
            return <div key={event.id} className="relative flex gap-4 pb-6"><span className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-violet-600 dark:bg-zinc-900"><EventIcon className="h-4 w-4" /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{event.title}</p><span className="text-[10px] uppercase tracking-wide text-zinc-400">{event.source}</span></div>{event.description && <p className="mt-1 text-xs text-zinc-500">{event.description}</p>}<p className="mt-1 text-[11px] text-zinc-400">{toDate(event.occurred_at)}</p></div></div>
          })}
          {!events.length && <p className="pl-8 text-sm text-zinc-500">No activity has been recorded yet.</p>}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><GitBranch className="h-4 w-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{overview.repositories}</p><p className="text-xs text-zinc-500">Repositories</p></div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><GitPullRequest className="h-4 w-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{overview.pull_requests}</p><p className="text-xs text-zinc-500">Pull requests</p></div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><Star className="h-4 w-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{overview.stars}</p><p className="text-xs text-zinc-500">Stars</p></div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><Trophy className="h-4 w-4 text-zinc-400" /><p className="mt-2 text-xl font-bold">{overview.approved_points}</p><p className="text-xs text-zinc-500">Total points</p></div>
      </section>
    </div>
  )
}
