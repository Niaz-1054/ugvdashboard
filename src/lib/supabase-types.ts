// Application types matching database schema

export type AppRole = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Semester {
  id: string;
  academic_session_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  academic_sessions?: AcademicSession;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
  created_at: string;
  updated_at: string;
}

export interface GradeMapping {
  id: string;
  letter_grade: string;
  grade_point: number;
  min_marks: number;
  max_marks: number;
  created_at: string;
  updated_at: string;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  subject_id: string;
  semester_id: string;
  created_at: string;
  profiles?: Profile;
  subjects?: Subject;
  semesters?: Semester;
}

export interface Enrollment {
  id: string;
  student_id: string;
  subject_id: string;
  semester_id: string;
  created_at: string;
  profiles?: Profile;
  subjects?: Subject;
  semesters?: Semester;
}

export interface Grade {
  id: string;
  enrollment_id: string;
  marks: number;
  grade_mapping_id: string | null;
  created_at: string;
  updated_at: string;
  enrollments?: Enrollment;
  grade_mappings?: GradeMapping;
}

export interface Feedback {
  id: string;
  student_id: string;
  subject: string;
  message: string;
  status: string;
  resolved_at: string | null;
  created_at: string;
  profiles?: Profile;
}

// GPA Calculation Types
export interface SubjectGrade {
  subjectCode: string;
  subjectName: string;
  credits: number;
  marks: number;
  letterGrade: string;
  gradePoint: number;
}

export interface SemesterGPA {
  semesterId: string;
  semesterName: string;
  sessionName: string;
  subjects: SubjectGrade[];
  gpa: number;
  totalCredits: number;
  earnedCredits: number;
}

export interface StudentTranscript {
  studentId: string;
  studentName: string;
  semesters: SemesterGPA[];
  cgpa: number;
  totalCredits: number;
}
