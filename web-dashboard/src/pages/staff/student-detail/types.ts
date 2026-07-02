export type StudentOverview = {
  id: string
  student_id: string
  name: string
  email: string
  department: string | null
  year: number | null
  section: string | null
  phone: string | null
  github_url: string | null
  leetcode_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  resume_url: string | null
  solved_easy: number
  solved_medium: number
  solved_hard: number
  repositories: number
  commits: number
  stars: number
  pull_requests: number
  tasks_total: number
  tasks_pending: number
  tasks_submitted: number
  tasks_approved: number
  tasks_rejected: number
  tasks_overdue: number
  approved_points: number
  last_activity_at: string | null
  github_last_synced_at: string | null
  leetcode_last_synced_at: string | null
}

export type DailyActivity = {
  platform: "github" | "leetcode"
  activity_date: string
  activity_count: number
  commits: number
  pull_requests: number
  issues: number
  easy: number
  medium: number
  hard: number
}

export type SolvedProblem = {
  id: string
  problem_number: string | null
  title: string
  slug: string
  problem_url: string
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown"
  tags: string[]
  solved_at: string
  source: string
  matched_task_id: string | null
}

export type TaskHistory = {
  assignment_id: string
  task_id: string
  title: string
  description: string | null
  difficulty: string
  points: number
  due_date: string | null
  assigned_at: string
  assignment_status: string
  submission_id: string | null
  proof_url: string | null
  remarks: string | null
  marks: number | null
  submitted_at: string | null
  submission_status: string | null
  is_overdue: boolean
}

export type ActivityEvent = {
  id: string
  event_type: string
  title: string
  description: string | null
  source: string
  metadata: Record<string, unknown>
  occurred_at: string
}
