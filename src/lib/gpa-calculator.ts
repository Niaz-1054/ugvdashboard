import { GradeMapping, SubjectGrade, SemesterGPA } from './supabase-types';

/**
 * Finds the appropriate grade mapping based on marks
 */
export function getGradeFromMarks(marks: number, gradeMappings: GradeMapping[]): GradeMapping | null {
  const sortedMappings = [...gradeMappings].sort((a, b) => b.min_marks - a.min_marks);
  
  for (const mapping of sortedMappings) {
    if (marks >= mapping.min_marks && marks <= mapping.max_marks) {
      return mapping;
    }
  }
  
  return null;
}

/**
 * Calculates GPA for a list of subject grades
 * Formula: GPA = Σ (Credit × Grade Point) ÷ Σ (Credits)
 */
export function calculateGPA(subjects: SubjectGrade[]): number {
  if (subjects.length === 0) return 0;
  
  const totalWeightedPoints = subjects.reduce(
    (sum, subject) => sum + (subject.credits * subject.gradePoint), 
    0
  );
  
  const totalCredits = subjects.reduce(
    (sum, subject) => sum + subject.credits, 
    0
  );
  
  if (totalCredits === 0) return 0;
  
  return Number((totalWeightedPoints / totalCredits).toFixed(2));
}

/**
 * Calculates CGPA across multiple semesters
 */
export function calculateCGPA(semesters: SemesterGPA[]): number {
  const allSubjects = semesters.flatMap(sem => sem.subjects);
  return calculateGPA(allSubjects);
}

/**
 * Gets GPA status/classification
 */
export function getGPAStatus(gpa: number): {
  label: string;
  color: 'excellent' | 'good' | 'average' | 'warning' | 'danger';
} {
  if (gpa >= 3.70) return { label: 'Excellent', color: 'excellent' };
  if (gpa >= 3.30) return { label: 'Very Good', color: 'good' };
  if (gpa >= 2.70) return { label: 'Good', color: 'average' };
  if (gpa >= 2.00) return { label: 'Satisfactory', color: 'warning' };
  return { label: 'Needs Improvement', color: 'danger' };
}

/**
 * Determines if a student is at academic risk
 */
export function isAtAcademicRisk(cgpa: number): boolean {
  return cgpa < 2.0;
}

/**
 * Calculates total earned credits (excluding failed subjects)
 */
export function calculateEarnedCredits(subjects: SubjectGrade[]): number {
  return subjects
    .filter(subject => subject.gradePoint >= 1.0) // D grade or above
    .reduce((sum, subject) => sum + subject.credits, 0);
}
