-- Student intelligence, activity history, heatmaps, and staff notifications.
-- New data is exposed only through credential-checked SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS public.leetcode_solved_problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  problem_number TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  problem_url TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'Unknown'
    CHECK (difficulty IN ('Easy', 'Medium', 'Hard', 'Unknown')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  solved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'extension',
  matched_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  external_submission_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, slug)
);

CREATE TABLE IF NOT EXISTS public.github_daily_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  contributions INTEGER NOT NULL DEFAULT 0 CHECK (contributions >= 0),
  commits INTEGER NOT NULL DEFAULT 0 CHECK (commits >= 0),
  pull_requests INTEGER NOT NULL DEFAULT 0 CHECK (pull_requests >= 0),
  issues INTEGER NOT NULL DEFAULT 0 CHECK (issues >= 0),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, activity_date)
);

CREATE TABLE IF NOT EXISTS public.leetcode_daily_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  solved INTEGER NOT NULL DEFAULT 0 CHECK (solved >= 0),
  easy INTEGER NOT NULL DEFAULT 0 CHECK (easy >= 0),
  medium INTEGER NOT NULL DEFAULT 0 CHECK (medium >= 0),
  hard INTEGER NOT NULL DEFAULT 0 CHECK (hard >= 0),
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, activity_date)
);

CREATE TABLE IF NOT EXISTS public.student_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  dedupe_key TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_activity_events_dedupe_idx
  ON public.student_activity_events(student_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  activity_event_id UUID REFERENCES public.student_activity_events(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_notification_preferences (
  staff_id UUID PRIMARY KEY REFERENCES public.staff(id) ON DELETE CASCADE,
  task_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  task_status_changes BOOLEAN NOT NULL DEFAULT TRUE,
  leetcode_solves BOOLEAN NOT NULL DEFAULT TRUE,
  github_milestones BOOLEAN NOT NULL DEFAULT TRUE,
  inactivity_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  sync_failures BOOLEAN NOT NULL DEFAULT TRUE,
  digest_mode TEXT NOT NULL DEFAULT 'realtime'
    CHECK (digest_mode IN ('realtime', 'daily', 'off')),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_sync_status (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('github', 'leetcode')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'syncing', 'success', 'error')),
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  PRIMARY KEY (student_id, platform)
);

CREATE INDEX IF NOT EXISTS leetcode_solved_student_date_idx
  ON public.leetcode_solved_problems(student_id, solved_at DESC);
CREATE INDEX IF NOT EXISTS github_daily_student_date_idx
  ON public.github_daily_activity(student_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS leetcode_daily_student_date_idx
  ON public.leetcode_daily_activity(student_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS student_activity_student_date_idx
  ON public.student_activity_events(student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS staff_notifications_unread_idx
  ON public.staff_notifications(staff_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE public.leetcode_solved_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leetcode_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sync_status ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.staff_can_view_student(
  p_staff_id UUID,
  p_password TEXT,
  p_student_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.staff sf
    JOIN public.students st ON st.id = p_student_id
    WHERE sf.id = p_staff_id
      AND sf.password = p_password
      AND (
        (sf.department_id IS NOT NULL AND sf.department_id = st.department_id)
        OR EXISTS (
          SELECT 1 FROM public.staff_assignments sa
          WHERE sa.staff_id = sf.id AND sa.student_id = st.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.create_student_event_and_notify(
  p_student_id UUID,
  p_event_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_source TEXT,
  p_metadata JSONB,
  p_dedupe_key TEXT,
  p_occurred_at TIMESTAMP WITH TIME ZONE,
  p_preference_column TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO public.student_activity_events (
    student_id, event_type, title, description, source, metadata, dedupe_key, occurred_at
  ) VALUES (
    p_student_id, p_event_type, p_title, p_description, p_source,
    COALESCE(p_metadata, '{}'::JSONB), p_dedupe_key, COALESCE(p_occurred_at, NOW())
  )
  ON CONFLICT (student_id, dedupe_key) WHERE dedupe_key IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    occurred_at = EXCLUDED.occurred_at
  RETURNING id INTO v_event_id;

  INSERT INTO public.staff_notifications (
    staff_id, student_id, activity_event_id, notification_type, title, message, action_url
  )
  SELECT DISTINCT
    sf.id,
    p_student_id,
    v_event_id,
    p_event_type,
    p_title,
    COALESCE(p_description, p_title),
    '/staff/students/' || p_student_id::TEXT
  FROM public.staff sf
  JOIN public.students st ON st.id = p_student_id
  LEFT JOIN public.staff_notification_preferences pref ON pref.staff_id = sf.id
  WHERE (
    (sf.department_id IS NOT NULL AND sf.department_id = st.department_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_assignments sa
      WHERE sa.staff_id = sf.id AND sa.student_id = st.id
    )
  )
  AND COALESCE(pref.digest_mode, 'realtime') <> 'off'
  AND CASE p_preference_column
    WHEN 'task_submissions' THEN COALESCE(pref.task_submissions, TRUE)
    WHEN 'task_status_changes' THEN COALESCE(pref.task_status_changes, TRUE)
    WHEN 'leetcode_solves' THEN COALESCE(pref.leetcode_solves, TRUE)
    WHEN 'github_milestones' THEN COALESCE(pref.github_milestones, TRUE)
    WHEN 'inactivity_alerts' THEN COALESCE(pref.inactivity_alerts, TRUE)
    WHEN 'sync_failures' THEN COALESCE(pref.sync_failures, TRUE)
    ELSE TRUE
  END
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_notifications n
    WHERE n.staff_id = sf.id AND n.activity_event_id = v_event_id
  );

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_student_activity(
  p_student_id UUID,
  p_password TEXT,
  p_website TEXT,
  p_duration INTEGER,
  p_activity_at TIMESTAMP WITH TIME ZONE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date DATE := (COALESCE(p_activity_at, NOW()) AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password
  ) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  IF p_duration <= 0 OR p_duration > 43200 THEN
    RAISE EXCEPTION 'Invalid activity duration.';
  END IF;

  INSERT INTO public.activity_logs(student_id, website, duration, activity_date)
  VALUES (p_student_id, LEFT(LOWER(p_website), 255), p_duration, v_date);

  INSERT INTO public.student_activity_events (
    student_id, event_type, title, description, source, metadata, dedupe_key, occurred_at
  ) VALUES (
    p_student_id,
    'website_activity',
    'Activity on ' || LEFT(LOWER(p_website), 255),
    ROUND(p_duration / 60.0, 1)::TEXT || ' minutes active',
    'extension',
    jsonb_build_object('website', LEFT(LOWER(p_website), 255), 'duration_seconds', p_duration),
    'website:' || v_date::TEXT || ':' || LEFT(LOWER(p_website), 255),
    COALESCE(p_activity_at, NOW())
  )
  ON CONFLICT (student_id, dedupe_key) WHERE dedupe_key IS NOT NULL
  DO UPDATE SET
    metadata = jsonb_build_object(
      'website', LEFT(LOWER(p_website), 255),
      'duration_seconds', COALESCE((public.student_activity_events.metadata->>'duration_seconds')::INTEGER, 0) + p_duration
    ),
    description = ROUND((COALESCE((public.student_activity_events.metadata->>'duration_seconds')::INTEGER, 0) + p_duration) / 60.0, 1)::TEXT || ' minutes active',
    occurred_at = GREATEST(public.student_activity_events.occurred_at, COALESCE(p_activity_at, NOW()));
END;
$$;

CREATE OR REPLACE FUNCTION public.record_leetcode_solve(
  p_student_id UUID,
  p_password TEXT,
  p_problem_number TEXT,
  p_title TEXT,
  p_slug TEXT,
  p_problem_url TEXT,
  p_difficulty TEXT,
  p_solved_at TIMESTAMP WITH TIME ZONE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_problem_id UUID;
  v_was_new BOOLEAN := FALSE;
  v_matched_task_id UUID;
  v_date DATE := (COALESCE(p_solved_at, NOW()) AT TIME ZONE 'UTC')::DATE;
  v_difficulty TEXT := CASE
    WHEN INITCAP(LOWER(p_difficulty)) IN ('Easy', 'Medium', 'Hard')
      THEN INITCAP(LOWER(p_difficulty))
    ELSE 'Unknown'
  END;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password
  ) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  SELECT ta.task_id INTO v_matched_task_id
  FROM public.task_assignments ta
  JOIN public.tasks t ON t.id = ta.task_id
  WHERE ta.student_id = p_student_id
    AND ta.status IN ('pending', 'submitted')
    AND (
      LOWER(t.title) LIKE '%' || LOWER(p_slug) || '%'
      OR LOWER(COALESCE(t.description, '')) LIKE '%' || LOWER(p_slug) || '%'
      OR (NULLIF(p_problem_number, '') IS NOT NULL AND (
        t.title ~ ('(^|[^0-9])' || p_problem_number || '([^0-9]|$)')
        OR COALESCE(t.description, '') ~ ('(^|[^0-9])' || p_problem_number || '([^0-9]|$)')
      ))
    )
  ORDER BY ta.assigned_at DESC
  LIMIT 1;

  INSERT INTO public.leetcode_solved_problems (
    student_id, problem_number, title, slug, problem_url, difficulty, solved_at, source, matched_task_id
  ) VALUES (
    p_student_id,
    NULLIF(p_problem_number, ''),
    COALESCE(NULLIF(p_title, ''), p_slug),
    LOWER(p_slug),
    p_problem_url,
    v_difficulty,
    COALESCE(p_solved_at, NOW()),
    'extension',
    v_matched_task_id
  )
  ON CONFLICT (student_id, slug) DO NOTHING
  RETURNING id INTO v_problem_id;

  v_was_new := v_problem_id IS NOT NULL;

  IF NOT v_was_new THEN
    SELECT id INTO v_problem_id
    FROM public.leetcode_solved_problems
    WHERE student_id = p_student_id AND slug = LOWER(p_slug);
    RETURN v_problem_id;
  END IF;

  INSERT INTO public.leetcode_daily_activity (
    student_id, activity_date, solved, easy, medium, hard, synced_at
  ) VALUES (
    p_student_id, v_date, 1,
    CASE WHEN v_difficulty = 'Easy' THEN 1 ELSE 0 END,
    CASE WHEN v_difficulty = 'Medium' THEN 1 ELSE 0 END,
    CASE WHEN v_difficulty = 'Hard' THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (student_id, activity_date) DO UPDATE SET
    solved = public.leetcode_daily_activity.solved + 1,
    easy = public.leetcode_daily_activity.easy + EXCLUDED.easy,
    medium = public.leetcode_daily_activity.medium + EXCLUDED.medium,
    hard = public.leetcode_daily_activity.hard + EXCLUDED.hard,
    synced_at = NOW();

  INSERT INTO public.leetcode_stats(student_id, easy, medium, hard, updated_at)
  VALUES (
    p_student_id,
    CASE WHEN v_difficulty = 'Easy' THEN 1 ELSE 0 END,
    CASE WHEN v_difficulty = 'Medium' THEN 1 ELSE 0 END,
    CASE WHEN v_difficulty = 'Hard' THEN 1 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (student_id) DO UPDATE SET
    easy = public.leetcode_stats.easy + EXCLUDED.easy,
    medium = public.leetcode_stats.medium + EXCLUDED.medium,
    hard = public.leetcode_stats.hard + EXCLUDED.hard,
    updated_at = NOW();

  PERFORM public.create_student_event_and_notify(
    p_student_id,
    'leetcode_solved',
    'LeetCode problem solved',
    COALESCE(NULLIF(p_title, ''), p_slug) || ' (' || v_difficulty || ')',
    'leetcode',
    jsonb_build_object(
      'problem_id', v_problem_id,
      'problem_number', p_problem_number,
      'slug', LOWER(p_slug),
      'url', p_problem_url,
      'difficulty', v_difficulty
    ),
    'leetcode:' || LOWER(p_slug),
    COALESCE(p_solved_at, NOW()),
    'leetcode_solves'
  );

  RETURN v_problem_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_student_overview(
  p_staff_id UUID,
  p_password TEXT,
  p_student_id UUID
)
RETURNS TABLE (
  id UUID,
  student_id TEXT,
  name TEXT,
  email TEXT,
  department TEXT,
  year INTEGER,
  section TEXT,
  phone TEXT,
  github_url TEXT,
  leetcode_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  resume_url TEXT,
  solved_easy INTEGER,
  solved_medium INTEGER,
  solved_hard INTEGER,
  repositories INTEGER,
  commits INTEGER,
  stars INTEGER,
  pull_requests INTEGER,
  tasks_total INTEGER,
  tasks_pending INTEGER,
  tasks_submitted INTEGER,
  tasks_approved INTEGER,
  tasks_rejected INTEGER,
  tasks_overdue INTEGER,
  approved_points INTEGER,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  github_last_synced_at TIMESTAMP WITH TIME ZONE,
  leetcode_last_synced_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_student(p_staff_id, p_password, p_student_id) THEN
    RAISE EXCEPTION 'Student not found or access denied.';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.student_id,
    s.name,
    s.email,
    d.name,
    s.year,
    s.section,
    s.phone,
    s.github_url,
    s.leetcode_url,
    s.linkedin_url,
    s.portfolio_url,
    (SELECT r.file_url FROM public.resumes r WHERE r.student_id = s.id ORDER BY r.uploaded_at DESC LIMIT 1),
    COALESCE(l.easy, 0),
    COALESCE(l.medium, 0),
    COALESCE(l.hard, 0),
    COALESCE(g.repositories, 0),
    COALESCE(g.commits, 0),
    COALESCE(g.stars, 0),
    COALESCE(g.pull_requests, 0),
    COUNT(ta.id)::INTEGER,
    COUNT(ta.id) FILTER (WHERE ta.status = 'pending')::INTEGER,
    COUNT(ta.id) FILTER (WHERE ta.status = 'submitted')::INTEGER,
    COUNT(ta.id) FILTER (WHERE ta.status = 'approved')::INTEGER,
    COUNT(ta.id) FILTER (WHERE ta.status = 'rejected')::INTEGER,
    COUNT(ta.id) FILTER (
      WHERE ta.status IN ('pending', 'submitted') AND t.due_date < NOW()
    )::INTEGER,
    COALESCE(SUM(ts.marks) FILTER (WHERE ts.status = 'approved'), 0)::INTEGER,
    GREATEST(
      MAX(ts.submitted_at),
      (SELECT MAX(e.occurred_at) FROM public.student_activity_events e WHERE e.student_id = s.id),
      (SELECT MAX(al.recorded_at) FROM public.activity_logs al WHERE al.student_id = s.id)
    ),
    (SELECT ss.last_success_at FROM public.student_sync_status ss WHERE ss.student_id = s.id AND ss.platform = 'github'),
    (SELECT ss.last_success_at FROM public.student_sync_status ss WHERE ss.student_id = s.id AND ss.platform = 'leetcode')
  FROM public.students s
  LEFT JOIN public.departments d ON d.id = s.department_id
  LEFT JOIN public.leetcode_stats l ON l.student_id = s.id
  LEFT JOIN public.github_stats g ON g.student_id = s.id
  LEFT JOIN public.task_assignments ta ON ta.student_id = s.id
  LEFT JOIN public.tasks t ON t.id = ta.task_id
  LEFT JOIN public.task_submissions ts ON ts.task_assignment_id = ta.id
  WHERE s.id = p_student_id
  GROUP BY s.id, s.student_id, s.name, s.email, d.name, s.year, s.section,
    s.phone, s.github_url, s.leetcode_url, s.linkedin_url, s.portfolio_url,
    l.easy, l.medium, l.hard, g.repositories, g.commits, g.stars, g.pull_requests;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_student_solved_problems(
  p_staff_id UUID,
  p_password TEXT,
  p_student_id UUID
)
RETURNS TABLE (
  id UUID,
  problem_number TEXT,
  title TEXT,
  slug TEXT,
  problem_url TEXT,
  difficulty TEXT,
  tags TEXT[],
  solved_at TIMESTAMP WITH TIME ZONE,
  source TEXT,
  matched_task_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_student(p_staff_id, p_password, p_student_id) THEN
    RAISE EXCEPTION 'Student not found or access denied.';
  END IF;

  RETURN QUERY
  SELECT p.id, p.problem_number, p.title, p.slug, p.problem_url, p.difficulty,
    p.tags, p.solved_at, p.source, p.matched_task_id
  FROM public.leetcode_solved_problems p
  WHERE p.student_id = p_student_id
  ORDER BY p.solved_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_student_daily_activity(
  p_staff_id UUID,
  p_password TEXT,
  p_student_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  platform TEXT,
  activity_date DATE,
  activity_count INTEGER,
  commits INTEGER,
  pull_requests INTEGER,
  issues INTEGER,
  easy INTEGER,
  medium INTEGER,
  hard INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_student(p_staff_id, p_password, p_student_id) THEN
    RAISE EXCEPTION 'Student not found or access denied.';
  END IF;

  RETURN QUERY
  SELECT 'github'::TEXT, g.activity_date, g.contributions, g.commits,
    g.pull_requests, g.issues, 0, 0, 0
  FROM public.github_daily_activity g
  WHERE g.student_id = p_student_id AND g.activity_date BETWEEN p_from AND p_to
  UNION ALL
  SELECT 'leetcode'::TEXT, l.activity_date, l.solved, 0, 0, 0,
    l.easy, l.medium, l.hard
  FROM public.leetcode_daily_activity l
  WHERE l.student_id = p_student_id AND l.activity_date BETWEEN p_from AND p_to
  ORDER BY 1, 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_student_task_history(
  p_staff_id UUID,
  p_password TEXT,
  p_student_id UUID
)
RETURNS TABLE (
  assignment_id UUID,
  task_id UUID,
  title TEXT,
  description TEXT,
  difficulty TEXT,
  points INTEGER,
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_at TIMESTAMP WITH TIME ZONE,
  assignment_status TEXT,
  submission_id UUID,
  proof_url TEXT,
  remarks TEXT,
  marks INTEGER,
  submitted_at TIMESTAMP WITH TIME ZONE,
  submission_status TEXT,
  is_overdue BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_student(p_staff_id, p_password, p_student_id) THEN
    RAISE EXCEPTION 'Student not found or access denied.';
  END IF;

  RETURN QUERY
  SELECT ta.id, t.id, t.title, t.description, t.difficulty, t.points, t.due_date,
    ta.assigned_at, ta.status, ts.id, ts.proof_url, ts.remarks, ts.marks,
    ts.submitted_at, ts.status,
    (t.due_date < NOW() AND ta.status IN ('pending', 'submitted'))
  FROM public.task_assignments ta
  JOIN public.tasks t ON t.id = ta.task_id
  LEFT JOIN public.task_submissions ts ON ts.task_assignment_id = ta.id
  WHERE ta.student_id = p_student_id
  ORDER BY COALESCE(ts.submitted_at, ta.assigned_at) DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_student_activity_feed(
  p_staff_id UUID,
  p_password TEXT,
  p_student_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  event_type TEXT,
  title TEXT,
  description TEXT,
  source TEXT,
  metadata JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.staff_can_view_student(p_staff_id, p_password, p_student_id) THEN
    RAISE EXCEPTION 'Student not found or access denied.';
  END IF;

  RETURN QUERY
  SELECT e.id, e.event_type, e.title, e.description, e.source, e.metadata, e.occurred_at
  FROM public.student_activity_events e
  WHERE e.student_id = p_student_id
  ORDER BY e.occurred_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_notifications(
  p_staff_id UUID,
  p_password TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  student_id UUID,
  student_name TEXT,
  notification_type TEXT,
  title TEXT,
  message TEXT,
  action_url TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT n.id, n.student_id, s.name, n.notification_type, n.title, n.message,
    n.action_url, n.read_at, n.created_at
  FROM public.staff_notifications n
  LEFT JOIN public.students s ON s.id = n.student_id
  WHERE n.staff_id = p_staff_id
  ORDER BY n.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_staff_notification_read(
  p_staff_id UUID,
  p_password TEXT,
  p_notification_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  UPDATE public.staff_notifications
  SET read_at = COALESCE(read_at, NOW())
  WHERE staff_id = p_staff_id
    AND (p_notification_id IS NULL OR id = p_notification_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_notification_preferences(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  task_submissions BOOLEAN,
  task_status_changes BOOLEAN,
  leetcode_solves BOOLEAN,
  github_milestones BOOLEAN,
  inactivity_alerts BOOLEAN,
  sync_failures BOOLEAN,
  digest_mode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  INSERT INTO public.staff_notification_preferences(staff_id)
  VALUES (p_staff_id)
  ON CONFLICT (staff_id) DO NOTHING;

  RETURN QUERY
  SELECT p.task_submissions, p.task_status_changes, p.leetcode_solves,
    p.github_milestones, p.inactivity_alerts, p.sync_failures, p.digest_mode
  FROM public.staff_notification_preferences p
  WHERE p.staff_id = p_staff_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_staff_notification_preferences(
  p_staff_id UUID,
  p_password TEXT,
  p_task_submissions BOOLEAN,
  p_task_status_changes BOOLEAN,
  p_leetcode_solves BOOLEAN,
  p_github_milestones BOOLEAN,
  p_inactivity_alerts BOOLEAN,
  p_sync_failures BOOLEAN,
  p_digest_mode TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;
  IF p_digest_mode NOT IN ('realtime', 'daily', 'off') THEN
    RAISE EXCEPTION 'Invalid digest mode.';
  END IF;

  INSERT INTO public.staff_notification_preferences (
    staff_id, task_submissions, task_status_changes, leetcode_solves,
    github_milestones, inactivity_alerts, sync_failures, digest_mode, updated_at
  ) VALUES (
    p_staff_id, p_task_submissions, p_task_status_changes, p_leetcode_solves,
    p_github_milestones, p_inactivity_alerts, p_sync_failures, p_digest_mode, NOW()
  )
  ON CONFLICT (staff_id) DO UPDATE SET
    task_submissions = EXCLUDED.task_submissions,
    task_status_changes = EXCLUDED.task_status_changes,
    leetcode_solves = EXCLUDED.leetcode_solves,
    github_milestones = EXCLUDED.github_milestones,
    inactivity_alerts = EXCLUDED.inactivity_alerts,
    sync_failures = EXCLUDED.sync_failures,
    digest_mode = EXCLUDED.digest_mode,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.run_student_inactivity_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_count INTEGER := 0;
  v_last_activity TIMESTAMP WITH TIME ZONE;
BEGIN
  FOR v_student IN SELECT id, name FROM public.students LOOP
    SELECT GREATEST(
      (SELECT MAX(e.occurred_at) FROM public.student_activity_events e WHERE e.student_id = v_student.id),
      (SELECT MAX(al.recorded_at) FROM public.activity_logs al WHERE al.student_id = v_student.id),
      (SELECT MAX(ts.submitted_at)
       FROM public.task_submissions ts
       JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
       WHERE ta.student_id = v_student.id)
    ) INTO v_last_activity;

    IF v_last_activity IS NOT NULL AND v_last_activity < NOW() - INTERVAL '7 days' THEN
      PERFORM public.create_student_event_and_notify(
        v_student.id,
        'inactivity_alert',
        'Student inactive for 7+ days',
        v_student.name || ' was last active ' || TO_CHAR(v_last_activity, 'DD Mon YYYY'),
        'system',
        jsonb_build_object('last_activity_at', v_last_activity),
        'inactive:' || DATE_TRUNC('week', NOW())::DATE::TEXT,
        NOW(),
        'inactivity_alerts'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_task_assignment_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  SELECT title INTO v_title FROM public.tasks WHERE id = NEW.task_id;
  PERFORM public.create_student_event_and_notify(
    NEW.student_id, 'task_assigned', 'New task assigned', v_title, 'tasks',
    jsonb_build_object('assignment_id', NEW.id, 'task_id', NEW.task_id),
    'task-assigned:' || NEW.id::TEXT, NEW.assigned_at, 'task_status_changes'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_task_submission_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_task_title TEXT;
  v_event_type TEXT;
BEGIN
  SELECT ta.student_id, t.title INTO v_student_id, v_task_title
  FROM public.task_assignments ta
  JOIN public.tasks t ON t.id = ta.task_id
  WHERE ta.id = NEW.task_assignment_id;

  v_event_type := CASE NEW.status
    WHEN 'approved' THEN 'task_approved'
    WHEN 'rejected' THEN 'task_rejected'
    ELSE 'task_submitted'
  END;

  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at THEN
    PERFORM public.create_student_event_and_notify(
      v_student_id,
      v_event_type,
      CASE NEW.status
        WHEN 'approved' THEN 'Task approved'
        WHEN 'rejected' THEN 'Task needs attention'
        ELSE 'New task submission'
      END,
      v_task_title,
      'tasks',
      jsonb_build_object(
        'submission_id', NEW.id,
        'assignment_id', NEW.task_assignment_id,
        'status', NEW.status,
        'marks', NEW.marks,
        'proof_url', NEW.proof_url
      ),
      'task-submission:' || NEW.id::TEXT || ':' || NEW.status,
      NEW.submitted_at,
      CASE WHEN NEW.status = 'pending' THEN 'task_submissions' ELSE 'task_status_changes' END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_assignment_activity_trigger ON public.task_assignments;
CREATE TRIGGER task_assignment_activity_trigger
AFTER INSERT ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.capture_task_assignment_event();

DROP TRIGGER IF EXISTS task_submission_activity_trigger ON public.task_submissions;
CREATE TRIGGER task_submission_activity_trigger
AFTER INSERT OR UPDATE ON public.task_submissions
FOR EACH ROW EXECUTE FUNCTION public.capture_task_submission_event();

GRANT EXECUTE ON FUNCTION public.staff_can_view_student(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_student_activity(UUID, TEXT, TEXT, INTEGER, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_leetcode_solve(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_student_overview(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_student_solved_problems(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_student_daily_activity(UUID, TEXT, UUID, DATE, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_student_task_history(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_student_activity_feed(UUID, TEXT, UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_notifications(UUID, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_staff_notification_read(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_notification_preferences(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_staff_notification_preferences(UUID, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.run_student_inactivity_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_student_inactivity_alerts() TO service_role;

-- Capture the historical task/submission data already present before this migration.
INSERT INTO public.student_activity_events (
  student_id, event_type, title, description, source, metadata, dedupe_key, occurred_at
)
SELECT ta.student_id, 'task_assigned', 'Task assigned', t.title, 'tasks',
  jsonb_build_object('assignment_id', ta.id, 'task_id', ta.task_id),
  'task-assigned:' || ta.id::TEXT, ta.assigned_at
FROM public.task_assignments ta
JOIN public.tasks t ON t.id = ta.task_id
ON CONFLICT (student_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

-- Make newly-created RPC signatures visible to PostgREST immediately after deploy.
NOTIFY pgrst, 'reload schema';

INSERT INTO public.student_activity_events (
  student_id, event_type, title, description, source, metadata, dedupe_key, occurred_at
)
SELECT ta.student_id,
  CASE ts.status WHEN 'approved' THEN 'task_approved' WHEN 'rejected' THEN 'task_rejected' ELSE 'task_submitted' END,
  CASE ts.status WHEN 'approved' THEN 'Task approved' WHEN 'rejected' THEN 'Task needs attention' ELSE 'Task submitted' END,
  t.title,
  'tasks',
  jsonb_build_object('submission_id', ts.id, 'assignment_id', ta.id, 'status', ts.status, 'marks', ts.marks),
  'task-submission:' || ts.id::TEXT || ':' || ts.status,
  ts.submitted_at
FROM public.task_submissions ts
JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
JOIN public.tasks t ON t.id = ta.task_id
ON CONFLICT (student_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
