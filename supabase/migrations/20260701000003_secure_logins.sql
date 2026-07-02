-- 1. Helper function to verify student login securely
CREATE OR REPLACE FUNCTION public.verify_student_login(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  student_id TEXT,
  name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.student_id, s.name, s.email
  FROM public.students s
  WHERE s.email = p_email AND s.password = p_password;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_login(TEXT, TEXT) TO anon, authenticated;

-- 2. Helper function to verify staff login securely
CREATE OR REPLACE FUNCTION public.verify_staff_login(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.email
  FROM public.staff s
  WHERE s.email = p_email AND s.password = p_password;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_login(TEXT, TEXT) TO anon, authenticated;
