-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for roles
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'student');

-- Profiles Table
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Departments Table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students Table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    year INTEGER CHECK (year >= 1 AND year <= 5),
    section TEXT,
    phone TEXT,
    github_url TEXT,
    leetcode_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT
);

-- Staff Assignments (Assign students to staff)
CREATE TABLE staff_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(staff_id, student_id)
);

-- Tasks Table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    points INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task Assignments
CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, student_id)
);

-- Task Submissions
CREATE TABLE task_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_assignment_id UUID REFERENCES task_assignments(id) ON DELETE CASCADE UNIQUE,
    proof_url TEXT,
    remarks TEXT,
    marks INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitHub Stats
CREATE TABLE github_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE UNIQUE,
    repositories INTEGER DEFAULT 0,
    commits INTEGER DEFAULT 0,
    stars INTEGER DEFAULT 0,
    pull_requests INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LeetCode Stats
CREATE TABLE leetcode_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE UNIQUE,
    easy INTEGER DEFAULT 0,
    medium INTEGER DEFAULT 0,
    hard INTEGER DEFAULT 0,
    contest_rating INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    website TEXT NOT NULL,
    duration INTEGER DEFAULT 0, -- in seconds
    activity_date DATE DEFAULT CURRENT_DATE
);

-- Resumes
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)

-- Profiles: Users can read their own profile. Admins/Staff can read all profiles.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by user who created them." ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins and Staff can view all profiles." ON profiles FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);
-- Allow public insert during development/signup (in production use a trigger from auth.users)
CREATE POLICY "Enable insert for authenticated users only" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Students:
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own data." ON students FOR SELECT USING (
    profile_id = auth.uid()
);
CREATE POLICY "Admins and Staff can view all students." ON students FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
);

-- Add basic public read access for now to simplify frontend prototyping. 
-- IN PRODUCTION, tighten these RLS policies.
CREATE POLICY "Allow public read access" ON departments FOR SELECT USING (true);
CREATE POLICY "Admins can create departments." ON departments FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update departments." ON departments FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Allow authenticated read access on tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access on task_assignments" ON task_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access on task_submissions" ON task_submissions FOR SELECT TO authenticated USING (true);

-- Function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  -- Never trust client-provided role metadata. Privileged roles are assigned only
  -- by the authenticated manage-user Edge Function.
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', 'New User'), 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false) ON CONFLICT DO NOTHING;
