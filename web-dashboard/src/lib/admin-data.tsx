import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export type DepartmentRecord = {
  id: string
  name: string
  createdAt: string | null
}

export type StaffRecord = {
  id: string
  name: string
  email: string
  departmentId: string | null
  department: string | null
  createdAt: string | null
  assignedStudents: number
}

export type StudentRecord = {
  id: string
  profileId: string
  studentId: string
  name: string
  email: string
  departmentId: string | null
  department: string | null
  year: number | null
  section: string | null
  phone: string | null
  githubUrl: string | null
  leetcodeUrl: string | null
  github: {
    repositories: number
    commits: number
    stars: number
    pullRequests: number
    updatedAt: string | null
  } | null
  leetcode: {
    easy: number
    medium: number
    hard: number
    contestRating: number
    streak: number
    updatedAt: string | null
  } | null
  tasks: {
    total: number
    pending: number
    submitted: number
    approved: number
    rejected: number
  }
}

type StaffRow = { id: string; name: string; email: string; department_id: string | null; created_at: string | null }
type DepartmentRow = { id: string; name: string; created_at: string | null }
type StudentRow = {
  id: string
  student_id: string
  name: string
  email: string
  department_id: string | null
  year: number | null
  section: string | null
  phone: string | null
  github_url: string | null
  leetcode_url: string | null
}
type GithubRow = { student_id: string; repositories: number; commits: number; stars: number; pull_requests: number; updated_at: string | null }
type LeetcodeRow = { student_id: string; easy: number; medium: number; hard: number; contest_rating: number; streak: number; updated_at: string | null }
type TaskAssignmentRow = { student_id: string; status: "pending" | "submitted" | "approved" | "rejected" }
type StaffAssignmentRow = { staff_id: string; student_id: string }

type AdminDataValue = {
  configured: boolean
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  departments: DepartmentRecord[]
  staff: StaffRecord[]
  students: StudentRecord[]
  refresh: () => Promise<void>
}

const AdminDataContext = createContext<AdminDataValue | null>(null)

const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [departments, setDepartments] = useState<DepartmentRecord[]>([])
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [students, setStudents] = useState<StudentRecord[]>([])

  const refresh = useCallback(async () => {
    if (!configured) {
      setDepartments([])
      setStaff([])
      setStudents([])
      setError("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live data.")
      setLoading(false)
      return
    }

    setLoading(true)
    const [departmentsResult, staffResult, studentsResult, githubResult, leetcodeResult, tasksResult, staffAssignmentsResult] = await Promise.all([
      supabase.from("departments").select("id,name,created_at").order("name"),
      supabase.from("staff").select("id,name,email,department_id,created_at").order("name"),
      supabase.from("students").select("id,student_id,name,email,department_id,year,section,phone,github_url,leetcode_url").order("student_id"),
      supabase.from("github_stats").select("student_id,repositories,commits,stars,pull_requests,updated_at"),
      supabase.from("leetcode_stats").select("student_id,easy,medium,hard,contest_rating,streak,updated_at"),
      supabase.from("task_assignments").select("student_id,status"),
      supabase.from("staff_assignments").select("staff_id,student_id"),
    ])

    const firstError = [departmentsResult.error, staffResult.error, studentsResult.error, githubResult.error, leetcodeResult.error, tasksResult.error, staffAssignmentsResult.error].find(Boolean)
    if (firstError) setError(firstError.message)
    else setError(null)

    const departmentRows = (departmentsResult.data ?? []) as unknown as DepartmentRow[]
    const staffRows = (staffResult.data ?? []) as unknown as StaffRow[]
    const studentRows = (studentsResult.data ?? []) as unknown as StudentRow[]
    const githubRows = (githubResult.data ?? []) as unknown as GithubRow[]
    const leetcodeRows = (leetcodeResult.data ?? []) as unknown as LeetcodeRow[]
    const taskRows = (tasksResult.data ?? []) as unknown as TaskAssignmentRow[]
    const staffAssignmentRows = (staffAssignmentsResult.data ?? []) as unknown as StaffAssignmentRow[]

    const departmentById = new Map(departmentRows.map((department) => [department.id, department.name]))
    const githubByStudent = new Map(githubRows.map((stats) => [stats.student_id, stats]))
    const leetcodeByStudent = new Map(leetcodeRows.map((stats) => [stats.student_id, stats]))

    setStaff(staffRows.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      departmentId: member.department_id,
      department: member.department_id ? departmentById.get(member.department_id) ?? null : null,
      createdAt: member.created_at,
      assignedStudents: staffAssignmentRows.filter((assignment) => assignment.staff_id === member.id).length,
    })))

    setDepartments(departmentRows.map((department) => ({ id: department.id, name: department.name, createdAt: department.created_at })))

    setStudents(studentRows.map((student) => {
      const github = githubByStudent.get(student.id)
      const leetcode = leetcodeByStudent.get(student.id)
      const assignments = taskRows.filter((assignment) => assignment.student_id === student.id)
      return {
        id: student.id,
        profileId: student.id,
        studentId: student.student_id,
        name: student.name,
        email: student.email ?? "",
        departmentId: student.department_id,
        department: student.department_id ? departmentById.get(student.department_id) ?? null : null,
        year: student.year,
        section: student.section,
        phone: student.phone,
        githubUrl: student.github_url,
        leetcodeUrl: student.leetcode_url,
        github: github ? { repositories: github.repositories, commits: github.commits, stars: github.stars, pullRequests: github.pull_requests, updatedAt: github.updated_at } : null,
        leetcode: leetcode ? { easy: leetcode.easy, medium: leetcode.medium, hard: leetcode.hard, contestRating: leetcode.contest_rating, streak: leetcode.streak, updatedAt: leetcode.updated_at } : null,
        tasks: {
          total: assignments.length,
          pending: assignments.filter((item) => item.status === "pending").length,
          submitted: assignments.filter((item) => item.status === "submitted").length,
          approved: assignments.filter((item) => item.status === "approved").length,
          rejected: assignments.filter((item) => item.status === "rejected").length,
        },
      }
    }))

    setLastUpdated(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    if (!configured) return

    const channel = supabase.channel("admin-live-data")
    for (const table of ["staff", "departments", "students", "staff_assignments", "task_assignments", "github_stats", "leetcode_stats"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => { void refresh() })
    }
    channel.subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [refresh])

  return <AdminDataContext.Provider value={{ configured, loading, error, lastUpdated, departments, staff, students, refresh }}>{children}</AdminDataContext.Provider>
}

export function useAdminData() {
  const value = useContext(AdminDataContext)
  if (!value) throw new Error("useAdminData must be used inside AdminDataProvider")
  return value
}
