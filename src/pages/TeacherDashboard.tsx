import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Users, Loader2, Save, AlertCircle, BarChart3, CheckCircle2, CloudOff, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { getGradeFromMarks } from '@/lib/gpa-calculator';
import { GradeMapping } from '@/lib/supabase-types';
import { SubjectAnalytics } from '@/components/teacher/SubjectAnalytics';
import { useGradeDrafts } from '@/hooks/useGradeDrafts';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('');
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [submittedGrades, setSubmittedGrades] = useState<Record<string, number>>({});
  const [gradeMappings, setGradeMappings] = useState<GradeMapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('grades');

  // Get current assignment details for draft scoping
  const currentAssignment = useMemo(() => 
    assignments.find(a => a.id === selectedAssignment),
    [assignments, selectedAssignment]
  );

  // Draft management hook
  const {
    draftGrades,
    setDraftGrade,
    clearDrafts,
    hasDrafts,
    draftStatus,
    getDraftCount,
  } = useGradeDrafts({
    teacherId: user?.id,
    subjectId: currentAssignment?.subject_id,
    semesterId: currentAssignment?.semester_id,
  });

  // Merge submitted and draft grades (drafts take precedence for display)
  const grades = useMemo(() => {
    return { ...submittedGrades, ...draftGrades };
  }, [submittedGrades, draftGrades]);

  useEffect(() => {
    if (user) {
      fetchTeacherData();
    }
  }, [user]);

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      // Fetch teacher assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('teacher_assignments')
        .select(`
          *,
          subjects(id, code, name, credits),
          semesters(id, name, is_locked, academic_sessions(name))
        `)
        .eq('teacher_id', user?.id);
      
      if (assignmentsError) throw assignmentsError;
      if (assignmentsData) setAssignments(assignmentsData);

      // Fetch grade mappings
      const { data: mappingsData } = await supabase
        .from('grade_mappings')
        .select('*')
        .order('min_marks', { ascending: false });
      
      if (mappingsData) setGradeMappings(mappingsData);

    } catch (error) {
      console.error('Error fetching teacher data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrollments = async (assignmentId: string) => {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    try {
      // Fetch enrollments for this subject/semester using LEFT JOINs
      const { data: enrollmentsData, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          subject_id,
          semester_id,
          profiles:profiles!left(id, full_name, student_id, email),
          grades:grades!left(id, marks, grade_mapping_id, grade_mappings(letter_grade, grade_point))
        `)
        .eq('subject_id', assignment.subject_id)
        .eq('semester_id', assignment.semester_id);
      
      // Debug log - remove after confirming fix
      console.log('Enrollments data:', enrollmentsData);

      if (error) throw error;
      
      if (enrollmentsData) {
        setEnrollments(enrollmentsData);
        
        // Initialize submitted grades state (from database)
        const initialGrades: Record<string, number> = {};
        enrollmentsData.forEach((enrollment: any) => {
          if (enrollment.grades?.[0]) {
            initialGrades[enrollment.id] = enrollment.grades[0].marks;
          }
        });
        setSubmittedGrades(initialGrades);
      }
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast.error('Failed to load student enrollments');
    }
  };

  useEffect(() => {
    if (selectedAssignment) {
      fetchEnrollments(selectedAssignment);
    }
  }, [selectedAssignment]);

  const handleGradeChange = (enrollmentId: string, marks: number) => {
    // Clear success state when user starts editing
    if (saveSuccess) setSaveSuccess(false);
    // Save to draft (auto-persisted to localStorage)
    setDraftGrade(enrollmentId, marks);
  };

  const saveGrades = async () => {
    setSaving(true);
    const assignment = assignments.find(a => a.id === selectedAssignment);
    
    if (assignment?.semesters?.is_locked) {
      toast.error('Cannot modify grades - semester is locked');
      setSaving(false);
      return;
    }

    try {
      // Prepare all grade records for upsert (merged submitted + draft)
      const gradeRecords = enrollments
        .filter(enrollment => grades[enrollment.id] !== undefined && !isNaN(grades[enrollment.id]))
        .map(enrollment => {
          const marks = grades[enrollment.id];
          const gradeMapping = getGradeFromMarks(marks, gradeMappings);
          return {
            enrollment_id: enrollment.id,
            marks,
            grade_mapping_id: gradeMapping?.id || null
          };
        });

      if (gradeRecords.length === 0) {
        toast.error('No valid marks to save');
        setSaving(false);
        return;
      }

      // Debug: Log the payload being sent
      console.log('Saving grades payload:', JSON.stringify(gradeRecords, null, 2));

      // Use upsert with enrollment_id as conflict key (grades has 1-to-1 with enrollments)
      const { data, error } = await supabase
        .from('grades')
        .upsert(gradeRecords, {
          onConflict: 'enrollment_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Supabase error saving grades:', error);
        toast.error(`Failed to save grades: ${error.message}`);
        return;
      }

      console.log('Grades saved successfully:', data);
      
      // Clear drafts after successful save
      clearDrafts();
      
      setSaveSuccess(true);
      toast.success('Grades saved successfully');
      fetchEnrollments(selectedAssignment);
      
      // Auto-clear success state after 5 seconds
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (error) {
      console.error('Error saving grades:', error);
      toast.error('Failed to save grades');
    } finally {
      setSaving(false);
    }
  };

  const getLetterGrade = (marks: number) => {
    const mapping = getGradeFromMarks(marks, gradeMappings);
    return mapping?.letter_grade || '-';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Teacher Dashboard</h2>
          <p className="text-muted-foreground">Manage your assigned subjects and enter student grades</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-100">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{assignments.length}</p>
                  <p className="text-sm text-muted-foreground">Assigned Subjects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{enrollments.length}</p>
                  <p className="text-sm text-muted-foreground">Students in Selected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Subject</CardTitle>
            <CardDescription>Choose a subject to manage grades</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a subject..." />
              </SelectTrigger>
              <SelectContent>
                {assignments.map((assignment) => (
                  <SelectItem key={assignment.id} value={assignment.id}>
                    {assignment.subjects?.code} - {assignment.subjects?.name} ({assignment.semesters?.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {assignments.length === 0 && (
              <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>No subjects assigned to you yet. Contact admin for assignments.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Grades and Analytics */}
        {selectedAssignment && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="grades" className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                Enter Grades
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            {/* Grade Entry Tab */}
            <TabsContent value="grades">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Enter Grades</CardTitle>
                      <CardDescription>
                        {assignments.find(a => a.id === selectedAssignment)?.subjects?.name}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Draft status indicator */}
                      {hasDrafts && !saveSuccess && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {draftStatus === 'saving' ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Saving draft...</span>
                            </>
                          ) : draftStatus === 'saved' ? (
                            <>
                              <CloudOff className="h-3.5 w-3.5" />
                              <span>Draft saved ({getDraftCount()} unsaved)</span>
                            </>
                          ) : (
                            <>
                              <CloudOff className="h-3.5 w-3.5" />
                              <span>{getDraftCount()} unsaved changes</span>
                            </>
                          )}
                        </div>
                      )}
                      
                      {assignments.find(a => a.id === selectedAssignment)?.semesters?.is_locked && (
                        <Badge variant="secondary">Semester Locked</Badge>
                      )}
                      {saveSuccess && (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-primary animate-in fade-in slide-in-from-right-2 duration-300">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Grades Saved</span>
                        </div>
                      )}
                      <Button 
                        onClick={saveGrades} 
                        disabled={saving || assignments.find(a => a.id === selectedAssignment)?.semesters?.is_locked}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Grades
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-32">Marks (0-100)</TableHead>
                        <TableHead className="w-28">Letter Grade</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((enrollment) => {
                        const isDraft = draftGrades[enrollment.id] !== undefined;
                        const isSubmitted = submittedGrades[enrollment.id] !== undefined;
                        const hasValue = grades[enrollment.id] !== undefined;
                        
                        return (
                          <TableRow key={enrollment.id} className={isDraft ? 'bg-muted/30' : ''}>
                            <TableCell className="font-mono">
                              {enrollment.profiles?.student_id ?? '—'}
                            </TableCell>
                            <TableCell>
                              {enrollment.profiles?.full_name ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                className="w-24"
                                value={grades[enrollment.id] ?? ''}
                                onChange={(e) => handleGradeChange(enrollment.id, parseFloat(e.target.value))}
                                disabled={assignments.find(a => a.id === selectedAssignment)?.semesters?.is_locked}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {hasValue ? getLetterGrade(grades[enrollment.id]) : '—'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isDraft ? (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-secondary-foreground/50" />
                                  Draft
                                </span>
                              ) : isSubmitted ? (
                                <span className="text-xs text-primary flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Saved
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {enrollments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No students enrolled in this subject
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <SubjectAnalytics
                enrollments={enrollments}
                grades={grades}
                gradeMappings={gradeMappings}
                subjectName={assignments.find(a => a.id === selectedAssignment)?.subjects?.name || ''}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
