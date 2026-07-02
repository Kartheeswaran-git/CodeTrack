import { createClient } from "npm:@supabase/supabase-js@2"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Student = {
  id: string
  name: string
  github_url: string | null
  leetcode_url: string | null
}

type GitHubContribDay = { date: string; count: number }
type GitHubEvent = {
  type: string
  created_at: string
  payload?: {
    commits?: unknown[]
    action?: string
    pull_request?: unknown
  }
}
type GitHubRepo = { stargazer_count: number; fork: boolean }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const usernameFromUrl = (value: string | null): string | null => {
  if (!value) return null
  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean)
    return parts.at(-1)?.replace(/^@/, "") || null
  } catch {
    return value.trim().replace(/^@/, "") || null
  }
}

// Safe JSON fetch — returns null on any error instead of throwing
const safeFetch = async (url: string, init?: RequestInit): Promise<unknown> => {
  try {
    const res = await fetch(url, init)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// GitHub sync — uses only public REST + contributions scraper (NO token)
// ---------------------------------------------------------------------------
const syncGitHub = async (
  admin: ReturnType<typeof createClient>,
  student: Student,
) => {
  const username = usernameFromUrl(student.github_url)
  if (!username) return { skipped: true, reason: "No GitHub URL set" }

  const now = new Date()
  const oneYearAgo = new Date(now)
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1)

  const ghHeaders = {
    "User-Agent": "CodeTrack-Pro/2.0",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  // ── 1. Basic user profile ────────────────────────────────────────────────
  const userPayload = await safeFetch(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    { headers: ghHeaders },
  ) as { public_repos?: number; message?: string } | null

  if (!userPayload) {
    throw new Error(
      `GitHub profile "${username}" not found or is private. Check the GitHub URL in the student profile.`,
    )
  }
  if ("message" in userPayload && userPayload.message === "Not Found") {
    throw new Error(
      `GitHub user "${username}" does not exist. Update the GitHub URL in the student profile.`,
    )
  }
  const totalRepos = userPayload.public_repos ?? 0

  // ── 2. Repos → stars (owner repos only, skip forks) ─────────────────────
  let stars = 0
  const reposPayload = await safeFetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=pushed`,
    { headers: ghHeaders },
  ) as GitHubRepo[] | null
  if (Array.isArray(reposPayload)) {
    stars = reposPayload
      .filter((r) => !r.fork)
      .reduce((sum, r) => sum + (r.stargazer_count ?? 0), 0)
  }

  // ── 3. Public events → commit + PR counts (last ~90 days from API) ───────
  let commits = 0
  let pullRequests = 0
  const eventsPayload = await safeFetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`,
    { headers: ghHeaders },
  ) as GitHubEvent[] | null
  if (Array.isArray(eventsPayload)) {
    for (const event of eventsPayload) {
      if (event.type === "PushEvent") {
        commits += Array.isArray(event.payload?.commits)
          ? event.payload.commits.length
          : 0
      }
      if (
        event.type === "PullRequestEvent" &&
        event.payload?.action === "opened"
      ) {
        pullRequests += 1
      }
    }
  }

  // ── 4. Contribution calendar heatmap (public scraper — no token needed) ──
  // Uses the open-source github-contributions-api which scrapes the public SVG
  let contributionDays: GitHubContribDay[] = []
  let totalContributions = 0

  const contribPayload = await safeFetch(
    `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`,
  ) as {
    contributions?: GitHubContribDay[]
    total?: Record<string, number>
  } | null

  if (contribPayload && Array.isArray(contribPayload.contributions)) {
    contributionDays = contribPayload.contributions.map((d) => ({
      date: d.date,
      count: d.count ?? 0,
    }))
    totalContributions =
      contribPayload.total?.lastYear ??
      contributionDays.reduce((s, d) => s + d.count, 0)
  }

  // Fallback: if the scraper was down, use events to build partial heatmap
  if (contributionDays.length === 0 && Array.isArray(eventsPayload)) {
    const dayMap = new Map<string, number>()
    for (const event of eventsPayload) {
      if (event.type !== "PushEvent") continue
      const date = event.created_at.slice(0, 10)
      const count = Array.isArray(event.payload?.commits)
        ? event.payload.commits.length
        : 1
      dayMap.set(date, (dayMap.get(date) ?? 0) + count)
    }
    contributionDays = [...dayMap].map(([date, count]) => ({ date, count }))
    totalContributions = [...dayMap.values()].reduce((s, c) => s + c, 0)
  }

  // ── 5. Persist to Supabase ───────────────────────────────────────────────
  if (contributionDays.length > 0) {
    const { error: daysError } = await admin
      .from("github_daily_activity")
      .upsert(
        contributionDays.map((day) => ({
          student_id: student.id,
          activity_date: day.date,
          contributions: day.count,
          synced_at: now.toISOString(),
        })),
        { onConflict: "student_id,activity_date" },
      )
    if (daysError) throw daysError
  }

  const { error: statsError } = await admin
    .from("github_stats")
    .upsert(
      {
        student_id: student.id,
        repositories: totalRepos,
        commits,
        pull_requests: pullRequests,
        stars,
        updated_at: now.toISOString(),
      },
      { onConflict: "student_id" },
    )
  if (statsError) throw statsError

  return {
    username,
    repositories: totalRepos,
    commits,
    pullRequests,
    stars,
    contributions: totalContributions,
    heatmapDays: contributionDays.length,
  }
}

// ---------------------------------------------------------------------------
// LeetCode sync — uses public GraphQL endpoint (NO token needed)
// ---------------------------------------------------------------------------
const syncLeetCode = async (
  admin: ReturnType<typeof createClient>,
  student: Student,
) => {
  const username = usernameFromUrl(student.leetcode_url)
  if (!username) return { skipped: true, reason: "No LeetCode URL set" }

  const query = `
    query StudentLeetCode($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
        submissionCalendar
      }
      recentAcSubmissionList(username: $username, limit: 100) {
        id title titleSlug timestamp statusDisplay
      }
    }
  `

  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://leetcode.com/u/${username}/`,
      "User-Agent": "CodeTrack-Pro/2.0",
      Origin: "https://leetcode.com",
    },
    body: JSON.stringify({ query, variables: { username } }),
  })

  if (!response.ok) {
    throw new Error(
      `LeetCode returned HTTP ${response.status}. The profile may be private or the username is incorrect.`,
    )
  }

  const payload = await response.json()
  if (payload.errors?.length) {
    throw new Error(`LeetCode: ${payload.errors[0].message}`)
  }

  const matched = payload.data?.matchedUser
  if (!matched) {
    throw new Error(
      `LeetCode user "${username}" was not found or is set to private. The student must make their profile public.`,
    )
  }

  // ── Stats (easy / medium / hard counts) ─────────────────────────────────
  const counts = Object.fromEntries(
    (matched.submitStatsGlobal?.acSubmissionNum ?? []).map(
      (item: { difficulty: string; count: number }) => [item.difficulty, item.count],
    ),
  )
  const now = new Date().toISOString()

  const { error: statsError } = await admin
    .from("leetcode_stats")
    .upsert(
      {
        student_id: student.id,
        easy: counts.Easy ?? 0,
        medium: counts.Medium ?? 0,
        hard: counts.Hard ?? 0,
        updated_at: now,
      },
      { onConflict: "student_id" },
    )
  if (statsError) throw statsError

  // ── Submission calendar → daily heatmap ─────────────────────────────────
  let rawCalendar: Record<string, number> = {}
  try {
    rawCalendar =
      typeof matched.submissionCalendar === "string"
        ? JSON.parse(matched.submissionCalendar)
        : (matched.submissionCalendar ?? {})
  } catch {
    rawCalendar = {}
  }

  const daily = new Map<string, number>()
  for (const [ts, count] of Object.entries(rawCalendar)) {
    const date = new Date(Number(ts) * 1000).toISOString().slice(0, 10)
    daily.set(date, (daily.get(date) ?? 0) + Number(count))
  }

  if (daily.size > 0) {
    const { error: calError } = await admin
      .from("leetcode_daily_activity")
      .upsert(
        [...daily].map(([activity_date, solved]) => ({
          student_id: student.id,
          activity_date,
          solved,
          synced_at: now,
        })),
        { onConflict: "student_id,activity_date" },
      )
    if (calError) throw calError
  }

  // ── Recent accepted submissions ──────────────────────────────────────────
  const accepted = (payload.data?.recentAcSubmissionList ?? []).filter(
    (s: { statusDisplay: string }) => s.statusDisplay === "Accepted",
  )

  if (accepted.length > 0) {
    const acceptedSlugs = accepted.map((s: { titleSlug: string }) =>
      s.titleSlug.toLowerCase(),
    )
    const { data: existing } = await admin
      .from("leetcode_solved_problems")
      .select("slug")
      .eq("student_id", student.id)
      .in("slug", acceptedSlugs)

    const existingSlugs = new Set(
      (existing ?? []).map((p: { slug: string }) => p.slug),
    )
    const newlySolved = accepted.filter(
      (s: { titleSlug: string }) =>
        !existingSlugs.has(s.titleSlug.toLowerCase()),
    )

    const { error: problemsError } = await admin
      .from("leetcode_solved_problems")
      .upsert(
        accepted.map(
          (s: {
            id: string
            title: string
            titleSlug: string
            timestamp: string
          }) => ({
            student_id: student.id,
            title: s.title,
            slug: s.titleSlug.toLowerCase(),
            problem_url: `https://leetcode.com/problems/${s.titleSlug}/`,
            difficulty: "Unknown",
            solved_at: new Date(Number(s.timestamp) * 1000).toISOString(),
            source: "scheduled_sync",
            external_submission_id: s.id,
          }),
        ),
        { onConflict: "student_id,slug", ignoreDuplicates: true },
      )
    if (problemsError) throw problemsError

    // Fire activity events for brand-new solves in the last 24 h
    for (const s of newlySolved) {
      const solvedAt = new Date(Number(s.timestamp) * 1000)
      if (solvedAt.getTime() < Date.now() - 24 * 60 * 60 * 1000) continue
      await admin.rpc("create_student_event_and_notify", {
        p_student_id: student.id,
        p_event_type: "leetcode_solved",
        p_title: "LeetCode problem solved",
        p_description: s.title,
        p_source: "leetcode",
        p_metadata: {
          slug: s.titleSlug,
          url: `https://leetcode.com/problems/${s.titleSlug}/`,
        },
        p_dedupe_key: `leetcode:${s.titleSlug.toLowerCase()}`,
        p_occurred_at: solvedAt.toISOString(),
        p_preference_column: "leetcode_solves",
      })
    }
  }

  return {
    username,
    easy: counts.Easy ?? 0,
    medium: counts.Medium ?? 0,
    hard: counts.Hard ?? 0,
    solved: (counts.Easy ?? 0) + (counts.Medium ?? 0) + (counts.Hard ?? 0),
    heatmapDays: daily.size,
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const cronSecret = Deno.env.get("SYNC_CRON_SECRET")
  const suppliedCronSecret = request.headers.get("x-cron-secret")
  const suppliedBearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const isScheduledRun = Boolean(
    (cronSecret && suppliedCronSecret === cronSecret) ||
      suppliedBearer === serviceKey,
  )

  // ── Auth: manual (staff-triggered) sync ─────────────────────────────────
  let manualStudentId: string | null = null
  if (!isScheduledRun) {
    let body: { staffId?: string; password?: string; studentId?: string } = {}
    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid request body" }, 400)
    }
    if (!body.staffId || !body.password || !body.studentId) {
      return json(
        { error: "staffId, password and studentId are required" },
        401,
      )
    }
    const { data: allowed, error: accessError } = await admin.rpc(
      "staff_can_view_student",
      {
        p_staff_id: body.staffId,
        p_password: body.password,
        p_student_id: body.studentId,
      },
    )
    if (accessError || !allowed) {
      return json({ error: "Student not found or access denied" }, 403)
    }
    manualStudentId = body.studentId
  }

  // ── Load student(s) ──────────────────────────────────────────────────────
  let studentQuery = admin
    .from("students")
    .select("id,name,github_url,leetcode_url")
    .or("github_url.not.is.null,leetcode_url.not.is.null")
  if (manualStudentId) {
    studentQuery = studentQuery.eq("id", manualStudentId)
  }
  const { data: students, error: fetchError } = await studentQuery
  if (fetchError) return json({ error: fetchError.message }, 500)

  // ── Sync each student ────────────────────────────────────────────────────
  const results: Record<string, unknown>[] = []

  for (const student of (students ?? []) as Student[]) {
    const result: Record<string, unknown> = {
      studentId: student.id,
      name: student.name,
    }

    for (const platform of ["github", "leetcode"] as const) {
      const hasUrl =
        platform === "github" ? Boolean(student.github_url) : Boolean(student.leetcode_url)
      if (!hasUrl) continue

      await admin.from("student_sync_status").upsert(
        {
          student_id: student.id,
          platform,
          status: "syncing",
          last_attempt_at: new Date().toISOString(),
          error_message: null,
        },
        { onConflict: "student_id,platform" },
      )

      try {
        const platformResult =
          platform === "github"
            ? await syncGitHub(admin, student)
            : await syncLeetCode(admin, student)

        result[platform] = platformResult

        await admin.from("student_sync_status").upsert(
          {
            student_id: student.id,
            platform,
            status: "success",
            last_attempt_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            error_message: null,
          },
          { onConflict: "student_id,platform" },
        )

        // GitHub milestone notifications
        if (
          platform === "github" &&
          "contributions" in platformResult &&
          typeof platformResult.contributions === "number" &&
          platformResult.contributions >= 100
        ) {
          const milestone =
            Math.floor(platformResult.contributions / 100) * 100
          await admin.rpc("create_student_event_and_notify", {
            p_student_id: student.id,
            p_event_type: "github_milestone",
            p_title: "GitHub contribution milestone",
            p_description: `${student.name} reached ${milestone}+ contributions in the last year`,
            p_source: "github",
            p_metadata: {
              milestone,
              contributions: platformResult.contributions,
            },
            p_dedupe_key: `github-milestone:${milestone}`,
            p_occurred_at: new Date().toISOString(),
            p_preference_column: "github_milestones",
          })
        }
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : String(caught)
        result[`${platform}Error`] = message

        await admin.from("student_sync_status").upsert(
          {
            student_id: student.id,
            platform,
            status: "error",
            last_attempt_at: new Date().toISOString(),
            error_message: message,
          },
          { onConflict: "student_id,platform" },
        )

        await admin.rpc("create_student_event_and_notify", {
          p_student_id: student.id,
          p_event_type: "sync_failure",
          p_title: `${platform === "github" ? "GitHub" : "LeetCode"} sync needs attention`,
          p_description: message,
          p_source: platform,
          p_metadata: { platform, error: message },
          p_dedupe_key: `sync-failure:${platform}:${new Date().toISOString().slice(0, 10)}`,
          p_occurred_at: new Date().toISOString(),
          p_preference_column: "sync_failures",
        })
      }
    }
    results.push(result)
  }

  if (isScheduledRun) {
    await admin.rpc("run_student_inactivity_alerts")
  }

  return json({ syncedAt: new Date().toISOString(), students: results })
})
