-- 1. Create staff table
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Modify staff_assignments to link staff_id to staff(id) instead of profiles(id)
ALTER TABLE public.staff_assignments 
  DROP CONSTRAINT IF EXISTS staff_assignments_staff_id_fkey;

ALTER TABLE public.staff_assignments
  ADD CONSTRAINT staff_assignments_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

-- 3. Modify students to store details directly and drop connection to profiles/auth.users
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_profile_id_fkey,
  DROP CONSTRAINT IF EXISTS students_profile_id_key;

ALTER TABLE public.students
  DROP COLUMN IF EXISTS profile_id;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'New Student',
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT 'password123';

-- 4. Enable RLS on the new staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies for staff table
DROP POLICY IF EXISTS "Allow authenticated read access on staff" ON public.staff;
CREATE POLICY "Allow authenticated read access on staff" ON public.staff 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage staff" ON public.staff;
CREATE POLICY "Admins can manage staff" ON public.staff
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- 6. Add RLS policies for students table
DROP POLICY IF EXISTS "Admins and Staff can view all students." ON public.students;
CREATE POLICY "Admins and Staff can view all students." ON public.students
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'staff'));

DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
CREATE POLICY "Admins can manage students" ON public.students
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');
