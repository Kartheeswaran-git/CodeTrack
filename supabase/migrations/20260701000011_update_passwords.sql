-- Create RPC functions to update student and staff passwords securely
CREATE OR REPLACE FUNCTION public.update_student_password(
  p_student_id UUID,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_old_password) THEN
    RAISE EXCEPTION 'Incorrect old password.';
  END IF;

  UPDATE public.students
  SET password = p_new_password
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_password(UUID, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_staff_password(
  p_staff_id UUID,
  p_old_password TEXT,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_old_password) THEN
    RAISE EXCEPTION 'Incorrect old password.';
  END IF;

  UPDATE public.staff
  SET password = p_new_password
  WHERE id = p_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_staff_password(UUID, TEXT, TEXT) TO anon, authenticated;
