-- Helper function for Staff Portal to list all tasks securely bypassing RLS
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
  -- Verify credentials
  IF NOT EXISTS (SELECT 1 FROM public.staff WHERE id = p_staff_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid staff credentials.';
  END IF;

  RETURN QUERY
  SELECT t.id, t.title, t.description, t.difficulty, t.points, t.due_date, t.created_at
  FROM public.tasks t
  ORDER BY t.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_tasks(UUID, TEXT) TO anon, authenticated;
