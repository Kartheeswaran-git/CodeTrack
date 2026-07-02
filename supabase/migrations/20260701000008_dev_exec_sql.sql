-- Temporary SQL execution helper for debugging database state
CREATE OR REPLACE FUNCTION public.dev_exec_sql(p_sql TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSON;
BEGIN
  EXECUTE 'SELECT json_agg(t) FROM (' || p_sql || ') t' INTO v_res;
  RETURN v_res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dev_exec_sql(TEXT) TO anon, authenticated;
