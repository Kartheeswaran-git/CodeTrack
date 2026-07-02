-- Temporary debug function to view task assignments and student UUIDs
CREATE OR REPLACE FUNCTION public.get_debug_assignments()
RETURNS TABLE (
  assignment_id UUID,
  task_id UUID,
  student_uuid UUID,
  student_reg_id TEXT,
  student_name TEXT,
  task_title TEXT,
  assignment_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ta.id AS assignment_id,
    ta.task_id,
    ta.student_id AS student_uuid,
    s.student_id AS student_reg_id,
    s.name AS student_name,
    t.title AS task_title,
    ta.status AS assignment_status
  FROM public.task_assignments ta
  JOIN public.students s ON s.id = ta.student_id
  JOIN public.tasks t ON t.id = ta.task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_debug_assignments() TO anon, authenticated;
