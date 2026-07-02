import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Bell, CheckCheck, CircleAlert, Code2, FileCheck2, Settings2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

type Notification = {
  id: string
  student_id: string | null
  student_name: string | null
  notification_type: string
  title: string
  message: string
  action_url: string | null
  read_at: string | null
  created_at: string
}

type Preferences = {
  task_submissions: boolean
  task_status_changes: boolean
  leetcode_solves: boolean
  github_milestones: boolean
  inactivity_alerts: boolean
  sync_failures: boolean
  digest_mode: "realtime" | "daily" | "off"
}

const defaultPreferences: Preferences = {
  task_submissions: true,
  task_status_changes: true,
  leetcode_solves: true,
  github_milestones: true,
  inactivity_alerts: true,
  sync_failures: true,
  digest_mode: "realtime",
}

const getStoredStaff = () => {
  const stored = localStorage.getItem("staff")
  return stored ? JSON.parse(stored) : null
}

export default function StaffNotificationCenter() {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences)

  const loadNotifications = useCallback(async (silent = false) => {
    const staff = getStoredStaff()
    if (!staff) return
    if (!silent) setLoading(true)
    const { data } = await supabase.rpc("get_staff_notifications", {
      p_staff_id: staff.id,
      p_password: staff.password,
      p_limit: 50,
    })
    if (data) setNotifications(data as Notification[])
    if (!silent) setLoading(false)
  }, [])

  const loadPreferences = useCallback(async () => {
    const staff = getStoredStaff()
    if (!staff) return
    const { data } = await supabase.rpc("get_staff_notification_preferences", {
      p_staff_id: staff.id,
      p_password: staff.password,
    })
    if (data?.[0]) setPreferences(data[0] as Preferences)
  }, [])

  useEffect(() => {
    void loadNotifications(true)
    void loadPreferences()
    const timer = window.setInterval(() => void loadNotifications(true), 30_000)
    const onVisible = () => { if (document.visibilityState === "visible") void loadNotifications(true) }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [loadNotifications, loadPreferences])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  const markRead = async (notificationId: string | null) => {
    const staff = getStoredStaff()
    if (!staff) return
    const { error } = await supabase.rpc("mark_staff_notification_read", {
      p_staff_id: staff.id,
      p_password: staff.password,
      p_notification_id: notificationId,
    })
    if (!error) {
      setNotifications((current) => current.map((item) => notificationId === null || item.id === notificationId ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item))
    }
  }

  const openNotification = async (notification: Notification) => {
    if (!notification.read_at) await markRead(notification.id)
    setOpen(false)
    if (notification.action_url) navigate(notification.action_url)
  }

  const savePreferences = async (next: Preferences) => {
    const staff = getStoredStaff()
    if (!staff) return
    setPreferences(next)
    const { error } = await supabase.rpc("update_staff_notification_preferences", {
      p_staff_id: staff.id,
      p_password: staff.password,
      p_task_submissions: next.task_submissions,
      p_task_status_changes: next.task_status_changes,
      p_leetcode_solves: next.leetcode_solves,
      p_github_milestones: next.github_milestones,
      p_inactivity_alerts: next.inactivity_alerts,
      p_sync_failures: next.sync_failures,
      p_digest_mode: next.digest_mode,
    })
    if (error) {
      setPreferences(preferences)
      return
    }
  }

  const unread = notifications.filter((notification) => !notification.read_at).length

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => { setOpen((value) => !value); void loadNotifications() }} className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && <div className="absolute right-0 top-11 z-50 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div><h2 className="text-sm font-bold">Student activity</h2><p className="text-[11px] text-zinc-400">{unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You are all caught up"}</p></div>
          <div className="flex items-center gap-2">{unread > 0 && <button onClick={() => void markRead(null)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}<button onClick={() => setSettingsOpen((value) => !value)} aria-label="Notification preferences" className={`rounded-md p-1.5 ${settingsOpen ? "bg-violet-100 text-violet-600 dark:bg-violet-950" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}><Settings2 className="h-3.5 w-3.5" /></button></div>
        </div>
        {settingsOpen && <div className="space-y-3 border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Alert preferences</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {([
              ["task_submissions", "Task submissions"],
              ["task_status_changes", "Task status"],
              ["leetcode_solves", "LeetCode solves"],
              ["github_milestones", "GitHub milestones"],
              ["inactivity_alerts", "Inactivity"],
              ["sync_failures", "Sync failures"],
            ] as [keyof Omit<Preferences, "digest_mode">, string][]).map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={preferences[key]} onChange={(event) => void savePreferences({ ...preferences, [key]: event.target.checked })} className="accent-violet-600" />{label}</label>)}
          </div>
        </div>}
        <div className="max-h-[430px] overflow-y-auto">
          {loading && !notifications.length ? <p className="p-8 text-center text-xs text-zinc-500">Loading notifications…</p> : notifications.map((notification) => {
            const Icon = notification.notification_type.includes("leetcode") ? Code2 : notification.notification_type.includes("task") ? FileCheck2 : CircleAlert
            return <button key={notification.id} onClick={() => void openNotification(notification)} className={`flex w-full gap-3 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${notification.read_at ? "" : "bg-violet-50/60 dark:bg-violet-950/20"}`}>
              <span className={`mt-0.5 rounded-lg p-2 ${notification.read_at ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300"}`}><Icon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{notification.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{notification.student_name ? `${notification.student_name}: ` : ""}{notification.message}</span><span className="mt-1 block text-[10px] text-zinc-400">{new Date(notification.created_at).toLocaleString()}</span></span>
              {!notification.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-600" />}
            </button>
          })}
          {!loading && !notifications.length && <div className="p-9 text-center"><Bell className="mx-auto h-6 w-6 text-zinc-300" /><p className="mt-2 text-xs font-medium text-zinc-500">No student activity notifications yet.</p></div>}
        </div>
      </div>}
    </div>
  )
}
