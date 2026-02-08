-- Fix: Allow teachers to read profiles of students enrolled in subjects they teach
-- This is necessary because teachers need to see student names/IDs when entering grades

CREATE POLICY "Teachers can view profiles of enrolled students"
ON public.profiles
FOR SELECT
USING (
  -- Teacher can view profiles of students enrolled in subjects they teach
  is_teacher(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.teacher_assignments ta ON ta.subject_id = e.subject_id AND ta.semester_id = e.semester_id
    WHERE e.student_id = profiles.id
    AND ta.teacher_id = auth.uid()
  )
);