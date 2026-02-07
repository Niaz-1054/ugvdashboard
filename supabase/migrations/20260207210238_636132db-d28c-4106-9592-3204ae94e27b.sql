-- =============================================
-- UGV GPA & Result Analytics System - Database Schema
-- =============================================

-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher', 'student');

-- 2. Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  student_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- 4. Create academic_sessions table
CREATE TABLE public.academic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create semesters table
CREATE TABLE public.semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create grade_mappings table (editable by admin)
CREATE TABLE public.grade_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_grade TEXT NOT NULL,
  grade_point DECIMAL(3,2) NOT NULL,
  min_marks INTEGER NOT NULL,
  max_marks INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create teacher_assignments table
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id, subject_id, semester_id)
);

-- 9. Create enrollments table
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  semester_id UUID NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, subject_id, semester_id)
);

-- 10. Create grades table
CREATE TABLE public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  marks DECIMAL(5,2) NOT NULL,
  grade_mapping_id UUID REFERENCES public.grade_mappings(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(enrollment_id)
);

-- 11. Create feedback table
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Security Functions (SECURITY DEFINER)
-- =============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Check if user is teacher
CREATE OR REPLACE FUNCTION public.is_teacher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'teacher')
$$;

-- Check if user is student
CREATE OR REPLACE FUNCTION public.is_student(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'student')
$$;

-- Check if teacher can manage a specific subject in semester
CREATE OR REPLACE FUNCTION public.teacher_manages_subject(_teacher_id UUID, _subject_id UUID, _semester_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments
    WHERE teacher_id = _teacher_id 
      AND subject_id = _subject_id 
      AND semester_id = _semester_id
  )
$$;

-- Get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- =============================================
-- Enable RLS on all tables
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies
-- =============================================

-- PROFILES
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- USER_ROLES
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- ACADEMIC_SESSIONS
CREATE POLICY "Everyone can view academic sessions" ON public.academic_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage academic sessions" ON public.academic_sessions
  FOR ALL USING (public.is_admin(auth.uid()));

-- SEMESTERS
CREATE POLICY "Everyone can view semesters" ON public.semesters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage semesters" ON public.semesters
  FOR ALL USING (public.is_admin(auth.uid()));

-- SUBJECTS
CREATE POLICY "Everyone can view subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage subjects" ON public.subjects
  FOR ALL USING (public.is_admin(auth.uid()));

-- GRADE_MAPPINGS
CREATE POLICY "Everyone can view grade mappings" ON public.grade_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage grade mappings" ON public.grade_mappings
  FOR ALL USING (public.is_admin(auth.uid()));

-- TEACHER_ASSIGNMENTS
CREATE POLICY "Admins can manage teacher assignments" ON public.teacher_assignments
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Teachers can view their own assignments" ON public.teacher_assignments
  FOR SELECT USING (teacher_id = auth.uid());

-- ENROLLMENTS
CREATE POLICY "Admins can manage enrollments" ON public.enrollments
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Students can view their own enrollments" ON public.enrollments
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers can view enrollments for their subjects" ON public.enrollments
  FOR SELECT USING (
    public.is_teacher(auth.uid()) AND 
    public.teacher_manages_subject(auth.uid(), subject_id, semester_id)
  );

-- GRADES
CREATE POLICY "Admins can manage all grades" ON public.grades
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Students can view their own grades" ON public.grades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e 
      WHERE e.id = enrollment_id AND e.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage grades for their subjects" ON public.grades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.teacher_assignments ta ON ta.subject_id = e.subject_id AND ta.semester_id = e.semester_id
      WHERE e.id = enrollment_id AND ta.teacher_id = auth.uid()
    )
  );

-- FEEDBACK
CREATE POLICY "Admins can manage all feedback" ON public.feedback
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Students can create and view their own feedback" ON public.feedback
  FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can insert feedback" ON public.feedback
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- =============================================
-- Update timestamp trigger
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academic_sessions_updated_at BEFORE UPDATE ON public.academic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_semesters_updated_at BEFORE UPDATE ON public.semesters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grade_mappings_updated_at BEFORE UPDATE ON public.grade_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Insert default grade mappings
-- =============================================

INSERT INTO public.grade_mappings (letter_grade, grade_point, min_marks, max_marks) VALUES
  ('A+', 4.00, 90, 100),
  ('A', 3.75, 85, 89),
  ('A-', 3.50, 80, 84),
  ('B+', 3.25, 75, 79),
  ('B', 3.00, 70, 74),
  ('B-', 2.75, 65, 69),
  ('C+', 2.50, 60, 64),
  ('C', 2.25, 55, 59),
  ('C-', 2.00, 50, 54),
  ('D', 1.00, 40, 49),
  ('F', 0.00, 0, 39);