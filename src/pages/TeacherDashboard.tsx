import { useState, useEffect } from 'react';
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
import { BookOpen, Users, Loader2, Save, AlertCircle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { getGradeFromMarks } from '@/lib/gpa-calculator';
import { GradeMapping } from '@/lib/supabase-types';
import { SubjectAnalytics } from '@/components/teacher/SubjectAnalytics';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>('');
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [gradeMappings, setGradeMappings] = useState<GradeMapping[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('grades');

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
      // Fetch enrollments for this subject/semester
      const { data: enrollmentsData, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          profiles(id, full_name, student_id, email),
          grades(id, marks, grade_mapping_id, grade_mappings(letter_grade, grade_point))
        `)
        .eq('subject_id', assignment.subject_id)
        .eq('semester_id', assignment.semester_id);

      if (error) throw error;
      
      if (enrollmentsData) {
        setEnrollments(enrollmentsData);
        
        // Initialize grades state
        const initialGrades: Record<string, number> = {};
        enrollmentsData.forEach((enrollment: any) => {
          if (enrollment.grades?.[0]) {
            initialGrades[enrollment.id] = enrollment.grades[0].marks;
          }
        });
        setGrades(initialGrades);
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
    setGrades(prev => ({
      ...prev,
      [enrollmentId]: marks
    }));
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
      for (const enrollment of enrollments) {
        const marks = grades[enrollment.id];
        if (marks === undefined) continue;

        // Find appropriate grade mapping
        const gradeMapping = getGradeFromMarks(marks, gradeMappings);

        if (enrollment.grades?.[0]) {
          // Update existing grade
          await supabase
            .from('grades')
            .update({
              marks,
              grade_mapping_id: gradeMapping?.id || null
            })
            .eq('id', enrollment.grades[0].id);
        } else {
          // Insert new grade
          await supabase
            .from('grades')
            .insert({
              enrollment_id: enrollment.id,
              marks,
              grade_mapping_id: gradeMapping?.id || null
            });
        }
      }

      toast.success('Grades saved successfully');
      fetchEnrollments(selectedAssignment);
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
                    <div className="flex items-center gap-2">
                      {assignments.find(a => a.id === selectedAssignment)?.semesters?.is_locked && (
                        <Badge variant="secondary">Semester Locked</Badge>
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
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Marks (0-100)</TableHead>
                        <TableHead>Letter Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((enrollment) => (
                        <TableRow key={enrollment.id}>
                          <TableCell className="font-mono">{enrollment.profiles?.student_id}</TableCell>
                          <TableCell>{enrollment.profiles?.full_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              className="w-24"
                              value={grades[enrollment.id] || ''}
                              onChange={(e) => handleGradeChange(enrollment.id, parseFloat(e.target.value))}
                              disabled={assignments.find(a => a.id === selectedAssignment)?.semesters?.is_locked}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {grades[enrollment.id] !== undefined ? getLetterGrade(grades[enrollment.id]) : '-'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {enrollments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
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
