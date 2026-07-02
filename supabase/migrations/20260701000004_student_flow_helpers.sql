-- Helper functions for Chrome Extension student app flow
-- All functions run with SECURITY DEFINER to bypass RLS and verify credentials locally via (id, password)

-- 1. Get Dashboard Stats
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
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  -- Calculate task counts
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

GRANT EXECUTE ON FUNCTION public.get_student_dashboard_stats(UUID, TEXT) TO anon, authenticated;

-- 2. Get Student Tasks list
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
  -- Verify credentials
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

GRANT EXECUTE ON FUNCTION public.get_student_tasks(UUID, TEXT) TO anon, authenticated;

-- 3. Submit Task
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
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  -- Find the assignment
  SELECT id INTO v_assignment_id
  FROM public.task_assignments
  WHERE student_id = p_student_id AND task_id = p_task_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Task assignment not found.';
  END IF;

  -- Insert or update submission
  INSERT INTO public.task_submissions (task_assignment_id, proof_url, remarks, status)
  VALUES (v_assignment_id, p_proof_url, p_remarks, 'pending')
  ON CONFLICT (task_assignment_id) 
  DO UPDATE SET proof_url = p_proof_url, remarks = p_remarks, status = 'pending', submitted_at = NOW();

  -- Update assignment status to submitted
  UPDATE public.task_assignments
  SET status = 'submitted'
  WHERE id = v_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_student_task(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- 4. Get Student Profile
CREATE OR REPLACE FUNCTION public.get_student_profile(
  p_student_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  student_id TEXT,
  name TEXT,
  email TEXT,
  department TEXT,
  department_id UUID,
  year INTEGER,
  section TEXT,
  phone TEXT,
  github_url TEXT,
  leetcode_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.student_id,
    s.name,
    s.email,
    d.name AS department,
    s.department_id,
    s.year,
    s.section,
    s.phone,
    s.github_url,
    s.leetcode_url,
    s.linkedin_url,
    s.portfolio_url
  FROM public.students s
  LEFT JOIN public.departments d ON d.id = s.department_id
  WHERE s.id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_profile(UUID, TEXT) TO anon, authenticated;

-- 5. Update Student Profile
CREATE OR REPLACE FUNCTION public.update_student_profile(
  p_student_id UUID,
  p_password TEXT,
  p_phone TEXT,
  p_github_url TEXT,
  p_leetcode_url TEXT,
  p_linkedin_url TEXT,
  p_portfolio_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  UPDATE public.students
  SET 
    phone = p_phone,
    github_url = p_github_url,
    leetcode_url = p_leetcode_url,
    linkedin_url = p_linkedin_url,
    portfolio_url = p_portfolio_url
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 6. Get Resume Drive Link
CREATE OR REPLACE FUNCTION public.get_student_resume(
  p_student_id UUID,
  p_password TEXT
)
RETURNS TABLE (
  file_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  RETURN QUERY
  SELECT r.file_url, r.uploaded_at
  FROM public.resumes r
  WHERE r.student_id = p_student_id
  ORDER BY r.uploaded_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_resume(UUID, TEXT) TO anon, authenticated;

-- 7. Update Resume Drive Link
CREATE OR REPLACE FUNCTION public.update_student_resume(
  p_student_id UUID,
  p_password TEXT,
  p_file_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  -- Upsert the resume record
  INSERT INTO public.resumes (student_id, file_url, uploaded_at)
  VALUES (p_student_id, p_file_url, NOW())
  ON CONFLICT (student_id) 
  DO UPDATE SET file_url = p_file_url, uploaded_at = NOW();
END;
$$;

-- Ensure there is a UNIQUE constraint on student_id for resumes upserts
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_student_id_key;
ALTER TABLE public.resumes ADD CONSTRAINT resumes_student_id_key UNIQUE (student_id);

GRANT EXECUTE ON FUNCTION public.update_student_resume(UUID, TEXT, TEXT) TO anon, authenticated;
