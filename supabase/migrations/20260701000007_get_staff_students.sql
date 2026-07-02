-- Helper function for Staff Portal to list students in their department securely bypassing RLS
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
  -- Verify credentials
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

GRANT EXECUTE ON FUNCTION public.get_staff_students(UUID, TEXT) TO anon, authenticated;
