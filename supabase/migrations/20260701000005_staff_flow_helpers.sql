-- Helper functions for Web Dashboard staff portal flow
-- All functions run with SECURITY DEFINER to bypass RLS and verify credentials locally via (id, password)

-- 1. Get Staff Dashboard Stats
CREATE OR REPLACE FUNCTION public.get_staff_dashboard_stats(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  assigned_students INTEGER,
  active_tasks INTEGER,
  pending_verifications INTEGER,
  tasks_approved INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_student_count INTEGER;
  v_active_tasks INTEGER;
  v_pending INTEGER;
  v_approved INTEGER;
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  -- 1. Assigned students count (by department)
  SELECT COUNT(*)::INTEGER INTO v_student_count
  FROM public.students
  WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id);

  -- 2. Active tasks count (total assignments for students in department)
  SELECT COUNT(*)::INTEGER INTO v_active_tasks
  FROM public.task_assignments
  WHERE student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  );

  -- 3. Pending verifications count
  SELECT COUNT(*)::INTEGER INTO v_pending
  FROM public.task_submissions ts
  JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
  WHERE ta.student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ) AND ts.status = 'pending';

  -- 4. Approved tasks count
  SELECT COUNT(*)::INTEGER INTO v_approved
  FROM public.task_submissions ts
  JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
  WHERE ta.student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ) AND ts.status = 'approved';

  RETURN QUERY SELECT v_student_count, v_active_tasks, v_pending, v_approved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_dashboard_stats(UUID, TEXT) TO anon, authenticated;

-- 2. Get Staff Recent Submissions
CREATE OR REPLACE FUNCTION public.get_staff_recent_submissions(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  submission_id UUID,
  student_name TEXT,
  task_title TEXT,
  proof_url TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  remarks TEXT,
  difficulty TEXT,
  points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT 
    ts.id AS submission_id,
    st.name AS student_name,
    t.title AS task_title,
    ts.proof_url,
    ts.submitted_at,
    ts.status,
    ts.remarks,
    t.difficulty,
    t.points
  FROM public.task_submissions ts
  JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
  JOIN public.students st ON st.id = ta.student_id
  JOIN public.tasks t ON t.id = ta.task_id
  WHERE ta.student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  )
  ORDER BY ts.submitted_at DESC
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_recent_submissions(UUID, TEXT) TO anon, authenticated;

-- 3. Get Staff Assigned Students Progress
CREATE OR REPLACE FUNCTION public.get_staff_assigned_students_progress(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  student_uuid UUID,
  student_id TEXT,
  name TEXT,
  email TEXT,
  solved_easy INTEGER,
  solved_medium INTEGER,
  solved_hard INTEGER,
  commits INTEGER,
  repositories INTEGER,
  approved_points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id AS student_uuid,
    s.student_id,
    s.name,
    s.email,
    COALESCE(l.easy, 0) AS solved_easy,
    COALESCE(l.medium, 0) AS solved_medium,
    COALESCE(l.hard, 0) AS solved_hard,
    COALESCE(g.commits, 0) AS commits,
    COALESCE(g.repositories, 0) AS repositories,
    COALESCE((
      SELECT SUM(t.points)::INTEGER 
      FROM public.task_submissions ts
      JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
      JOIN public.tasks t ON t.id = ta.task_id
      WHERE ta.student_id = s.id AND ts.status = 'approved'
    ), 0) AS approved_points
  FROM public.students s
  LEFT JOIN public.leetcode_stats l ON l.student_id = s.id
  LEFT JOIN public.github_stats g ON g.student_id = s.id
  WHERE s.department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ORDER BY s.student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_assigned_students_progress(UUID, TEXT) TO anon, authenticated;

-- 4. Verify Task Submission
CREATE OR REPLACE FUNCTION public.verify_task_submission(
  p_staff_id UUID,
  p_password TEXT,
  p_submission_id UUID,
  p_status TEXT, -- 'approved' or 'rejected'
  p_remarks TEXT,
  p_marks INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_assignment_id UUID;
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  -- Get target assignment
  SELECT task_assignment_id INTO v_assignment_id
  FROM public.task_submissions
  WHERE id = p_submission_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found.';
  END IF;

  -- Update submission details
  UPDATE public.task_submissions
  SET 
    status = p_status,
    remarks = p_remarks,
    marks = p_marks
  WHERE id = p_submission_id;

  -- Update assignment status
  UPDATE public.task_assignments
  SET status = p_status
  WHERE id = v_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_task_submission(UUID, TEXT, UUID, TEXT, TEXT, INTEGER) TO anon, authenticated;

-- 5. Get Leaderboard
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  rank_num INTEGER,
  name TEXT,
  email TEXT,
  student_id TEXT,
  department_name TEXT,
  points INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT 
    (ROW_NUMBER() OVER (ORDER BY COALESCE(totals.points, 0) DESC, s.student_id ASC))::INTEGER AS rank_num,
    s.name,
    s.email,
    s.student_id,
    COALESCE(d.name, '—') AS department_name,
    COALESCE(totals.points, 0)::INTEGER AS points
  FROM public.students s
  LEFT JOIN public.departments d ON d.id = s.department_id
  LEFT JOIN (
    SELECT ta.student_id, SUM(t.points) AS points
    FROM public.task_submissions ts
    JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
    JOIN public.tasks t ON t.id = ta.task_id
    WHERE ts.status = 'approved'
    GROUP BY ta.student_id
  ) totals ON totals.student_id = s.id
  ORDER BY points DESC, s.student_id ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(UUID, TEXT) TO anon, authenticated;

-- 6. Create Coding Task RPC
CREATE OR REPLACE FUNCTION public.create_staff_task(
  p_staff_id UUID,
  p_password TEXT,
  p_title TEXT,
  p_description TEXT,
  p_difficulty TEXT,
  p_points INTEGER,
  p_due_date TIMESTAMP WITH TIME ZONE
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

  INSERT INTO public.tasks (title, description, difficulty, points, due_date)
  VALUES (p_title, p_description, p_difficulty, p_points, p_due_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_staff_task(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;

-- 7. Assign Task to Student RPC
CREATE OR REPLACE FUNCTION public.assign_staff_task(
  p_staff_id UUID,
  p_password TEXT,
  p_task_id UUID,
  p_student_id UUID
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

  INSERT INTO public.task_assignments (task_id, student_id, status)
  VALUES (p_task_id, p_student_id, 'pending')
  ON CONFLICT (task_id, student_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_staff_task(UUID, TEXT, UUID, UUID) TO anon, authenticated;
