-- Prevent users from assigning themselves privileged roles during signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', 'New User'), 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Read the caller's role without recursively invoking the profiles RLS policy.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS "Admins and Staff can view all profiles." ON profiles;
CREATE POLICY "Admins and Staff can view all profiles." ON profiles
FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "Admins and Staff can view all students." ON students;
CREATE POLICY "Admins and Staff can view all students." ON students
FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin', 'staff'));

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins and Staff can view assignments." ON staff_assignments;
CREATE POLICY "Admins and Staff can view assignments." ON staff_assignments
FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin', 'staff'));

ALTER TABLE github_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authorized users can view GitHub stats." ON github_stats;
CREATE POLICY "Authorized users can view GitHub stats." ON github_stats
FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin', 'staff') OR EXISTS (SELECT 1 FROM students WHERE students.id = github_stats.student_id AND students.profile_id = auth.uid()));

ALTER TABLE leetcode_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authorized users can view LeetCode stats." ON leetcode_stats;
CREATE POLICY "Authorized users can view LeetCode stats." ON leetcode_stats
FOR SELECT TO authenticated
USING (public.current_user_role() IN ('admin', 'staff') OR EXISTS (SELECT 1 FROM students WHERE students.id = leetcode_stats.student_id AND students.profile_id = auth.uid()));

-- Only admins can create or rename departments.
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can create departments." ON departments;
CREATE POLICY "Admins can create departments." ON departments
FOR INSERT TO authenticated
WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Admins can update departments." ON departments;
CREATE POLICY "Admins can update departments." ON departments
FOR UPDATE TO authenticated
USING (public.current_user_role() = 'admin')
WITH CHECK (public.current_user_role() = 'admin');
