-- 1. Drop existing helper functions to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_student_dashboard_stats(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_tasks(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.submit_student_task(UUID, TEXT, UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_dashboard_stats(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_recent_submissions(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_assigned_students_progress(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.verify_task_submission(UUID, TEXT, UUID, TEXT, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_leaderboard(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_staff_task(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMP WITH TIME ZONE) CASCADE;
DROP FUNCTION IF EXISTS public.assign_staff_task(UUID, TEXT, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_all_tasks(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_staff_students(UUID, TEXT) CASCADE;

-- 2. Student Dashboard Stats RPC
CREATE OR REPLACE FUNCTION public.get_student_dashboard_stats(
  p_student_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  easy_solved INTEGER,
  medium_solved INTEGER,
  hard_solved INTEGER,
  commits INTEGER,
  repositories INTEGER,
  pending_tasks INTEGER,
  placement_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_tasks INTEGER;
  v_approved_tasks INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'approved')
  INTO v_total_tasks, v_approved_tasks
  FROM public.task_assignments
  WHERE student_id = p_student_id;

  RETURN QUERY
  SELECT 
    COALESCE(l.easy, 0) AS easy_solved,
    COALESCE(l.medium, 0) AS medium_solved,
    COALESCE(l.hard, 0) AS hard_solved,
    COALESCE(g.commits, 0) AS commits,
    COALESCE(g.repositories, 0) AS repositories,
    COALESCE((SELECT COUNT(*)::INTEGER FROM public.task_assignments WHERE student_id = p_student_id AND status = 'pending'), 0) AS pending_tasks,
    CASE 
      WHEN v_total_tasks > 0 THEN ((v_approved_tasks * 100) / v_total_tasks)::INTEGER
      ELSE 100::INTEGER
    END AS placement_score
  FROM public.students s
  LEFT JOIN public.leetcode_stats l ON l.student_id = s.id
  LEFT JOIN public.github_stats g ON g.student_id = s.id
  WHERE s.id = p_student_id;
END;
$$;

-- 3. Student Tasks RPC
CREATE OR REPLACE FUNCTION public.get_student_tasks(
  p_student_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  assignment_id UUID,
  task_id UUID,
  title TEXT,
  description TEXT,
  difficulty TEXT,
  points INTEGER,
  due_date TIMESTAMP WITH TIME ZONE,
  status TEXT,
  proof_url TEXT,
  remarks TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  RETURN QUERY
  SELECT 
    a.id AS assignment_id,
    t.id AS task_id,
    t.title,
    t.description,
    t.difficulty,
    t.points,
    t.due_date,
    a.status,
    s.proof_url,
    s.remarks
  FROM public.task_assignments a
  JOIN public.tasks t ON t.id = a.task_id
  LEFT JOIN public.task_submissions s ON s.task_assignment_id = a.id
  WHERE a.student_id = p_student_id
  ORDER BY t.due_date ASC NULLS LAST;
END;
$$;

-- 4. Submit Task RPC
CREATE OR REPLACE FUNCTION public.submit_student_task(
  p_student_id UUID,
  p_password TEXT,
  p_task_id UUID,
  p_proof_url TEXT,
  p_remarks TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  SELECT id INTO v_assignment_id
  FROM public.task_assignments
  WHERE student_id = p_student_id AND task_id = p_task_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Task assignment not found.';
  END IF;

  INSERT INTO public.task_submissions (task_assignment_id, proof_url, remarks, status)
  VALUES (v_assignment_id, p_proof_url, p_remarks, 'pending')
  ON CONFLICT (task_assignment_id) 
  DO UPDATE SET proof_url = p_proof_url, remarks = p_remarks, status = 'pending', submitted_at = NOW();

  UPDATE public.task_assignments
  SET status = 'submitted'
  WHERE id = v_assignment_id;
END;
$$;

-- 5. Staff Dashboard Stats RPC (Department-Based)
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
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_student_count
  FROM public.students
  WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id);

  SELECT COUNT(*)::INTEGER INTO v_active_tasks
  FROM public.task_assignments
  WHERE student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  );

  SELECT COUNT(*)::INTEGER INTO v_pending
  FROM public.task_submissions ts
  JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
  WHERE ta.student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ) AND ts.status = 'pending';

  SELECT COUNT(*)::INTEGER INTO v_approved
  FROM public.task_submissions ts
  JOIN public.task_assignments ta ON ta.id = ts.task_assignment_id
  WHERE ta.student_id IN (
    SELECT id FROM public.students WHERE department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ) AND ts.status = 'approved';

  RETURN QUERY SELECT v_student_count, v_active_tasks, v_pending, v_approved;
END;
$$;

-- 6. Staff Recent Submissions RPC (Department-Based)
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

-- 7. Staff Assigned Students Progress RPC (Department-Based)
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

-- 8. Verify Submission RPC
CREATE OR REPLACE FUNCTION public.verify_task_submission(
  p_staff_id UUID,
  p_password TEXT,
  p_submission_id UUID,
  p_status TEXT,
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
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  SELECT task_assignment_id INTO v_assignment_id
  FROM public.task_submissions
  WHERE id = p_submission_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Submission not found.';
  END IF;

  UPDATE public.task_submissions
  SET status = p_status, remarks = p_remarks, marks = p_marks
  WHERE id = p_submission_id;

  UPDATE public.task_assignments
  SET status = p_status
  WHERE id = v_assignment_id;
END;
$$;

-- 9. Leaderboard RPC
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

-- 10. Create Task RPC
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

-- 11. Assign Task RPC
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

-- 12. Fetch All Tasks RPC
CREATE OR REPLACE FUNCTION public.get_all_tasks(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  difficulty TEXT,
  points INTEGER,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT t.id, t.title, t.description, t.difficulty, t.points, t.due_date, t.created_at
  FROM public.tasks t
  ORDER BY t.created_at DESC;
END;
$$;

-- 13. Fetch Staff Department Students RPC
CREATE OR REPLACE FUNCTION public.get_staff_students(
  p_staff_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  student_id TEXT,
  name TEXT,
  email TEXT,
  department_id UUID,
  department_name TEXT,
  year INTEGER,
  section TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.student_id,
    s.name,
    s.email,
    s.department_id,
    COALESCE(d.name, '—') AS department_name,
    s.year,
    s.section,
    s.phone
  FROM public.students s
  LEFT JOIN public.departments d ON d.id = s.department_id
  WHERE s.department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ORDER BY s.student_id;
END;
$$;

-- 14. Grant EXECUTE permissions to all functions for anon / authenticated access
GRANT EXECUTE ON FUNCTION public.get_student_dashboard_stats(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_tasks(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_student_task(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_dashboard_stats(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_recent_submissions(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_assigned_students_progress(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_task_submission(UUID, TEXT, UUID, TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_task(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staff_task(UUID, TEXT, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_tasks(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_students(UUID, TEXT) TO anon, authenticated;

-- 15. Reload PostgREST cache
NOTIFY pgrst, 'reload schema';
