-- Create delete task and task completion report functions
CREATE OR REPLACE FUNCTION public.delete_staff_task(
  p_staff_id UUID,
  p_password TEXT,
  p_task_id UUID
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

  DELETE FROM public.tasks WHERE id = p_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_staff_task(UUID, TEXT, UUID) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_task_completion_report(
  p_staff_id UUID,
  p_password TEXT,
  p_task_id UUID
)
RETURNS TABLE (
  student_uuid UUID,
  student_id TEXT,
  student_name TEXT,
  email TEXT,
  assignment_status TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  marks INTEGER,
  remarks TEXT
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
    s.name AS student_name,
    s.email,
    COALESCE(ta.status, 'not_assigned') AS assignment_status,
    ts.submitted_at,
    ts.marks,
    ts.remarks
  FROM public.students s
  LEFT JOIN public.task_assignments ta ON ta.student_id = s.id AND ta.task_id = p_task_id
  LEFT JOIN public.task_submissions ts ON ts.task_assignment_id = ta.id
  WHERE s.department_id = (SELECT department_id FROM public.staff WHERE id = p_staff_id)
  ORDER BY s.student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_task_completion_report(UUID, TEXT, UUID) TO anon, authenticated;
