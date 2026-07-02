-- Create RPC function to auto-approve LeetCode tasks when completed
CREATE OR REPLACE FUNCTION public.auto_submit_leetcode_task(
  p_student_id UUID,
  p_password TEXT,
  p_task_id UUID,
  p_proof_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id UUID;
BEGIN
  -- Verify student credentials
  IF NOT EXISTS (SELECT 1 FROM public.students WHERE id = p_student_id AND password = p_password) THEN
    RAISE EXCEPTION 'Invalid student credentials.';
  END IF;

  SELECT id INTO v_assignment_id
  FROM public.task_assignments
  WHERE student_id = p_student_id AND task_id = p_task_id;

  IF v_assignment_id IS NULL THEN
    RAISE EXCEPTION 'Task assignment not found.';
  END IF;

  -- Insert/Update submission directly as approved
  INSERT INTO public.task_submissions (task_assignment_id, proof_url, remarks, status, marks, submitted_at)
  VALUES (
    v_assignment_id, 
    p_proof_url, 
    'Auto-verified by CodeTrack Pro Extension.', 
    'approved', 
    (SELECT points FROM public.tasks WHERE id = p_task_id),
    NOW()
  )
  ON CONFLICT (task_assignment_id) 
  DO UPDATE SET 
    proof_url = p_proof_url, 
    remarks = 'Auto-verified by CodeTrack Pro Extension.', 
    status = 'approved', 
    marks = (SELECT points FROM public.tasks WHERE id = p_task_id),
    submitted_at = NOW();

  -- Update assignment status directly to approved
  UPDATE public.task_assignments
  SET status = 'approved'
  WHERE id = v_assignment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_submit_leetcode_task(UUID, TEXT, UUID, TEXT) TO anon, authenticated;
