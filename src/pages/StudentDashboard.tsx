import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  GraduationCap, TrendingUp, BookOpen, AlertTriangle, 
  Calculator, MessageSquare, Loader2, Send
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  calculateGPA, calculateCGPA, getGPAStatus, isAtAcademicRisk,
  calculateEarnedCredits, getGradeFromMarks
} from '@/lib/gpa-calculator';
import { SubjectGrade, SemesterGPA, GradeMapping } from '@/lib/supabase-types';
import { GPAInsights } from '@/components/student/GPAInsights';
import { sortSemestersChronologically } from '@/lib/semester-utils';

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [gradeMappings, setGradeMappings] = useState<GradeMapping[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [feedback, setFeedback] = useState({ subject: '', message: '' });
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  
  // GPA Simulator state - stores selected grade points keyed by enrollment id
  const [simulatedGradePoints, setSimulatedGradePoints] = useState<Record<string, number>>({});
  
  // Selected semester for transcript view (default to most recent)
  const [selectedTranscriptSemester, setSelectedTranscriptSemester] = useState<string | null>(null);
  
  // Selected semester for GPA simulator (default to most recent)
  const [selectedSimulatorSemester, setSelectedSimulatorSemester] = useState<string | null>(null);
  
  // Fixed grade options for simulator
  const gradeOptions = [
    { label: 'A+', gradePoint: 4.00 },
    { label: 'A',  gradePoint: 3.75 },
    { label: 'A-', gradePoint: 3.50 },
    { label: 'B+', gradePoint: 3.25 },
    { label: 'B',  gradePoint: 3.00 },
    { label: 'B-', gradePoint: 2.75 },
    { label: 'C+', gradePoint: 2.50 },
    { label: 'C',  gradePoint: 2.25 },
    { label: 'D',  gradePoint: 2.00 },
    { label: 'F',  gradePoint: 0.00 },
  ];

  // Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
  const getOrdinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
  }, [user]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // Fetch enrollments with subjects, semesters, and grades
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          *,
          subjects(id, code, name, credits),
          semesters(id, name, academic_sessions(id, name)),
          grades(id, marks, grade_mappings(letter_grade, grade_point))
        `)
        .eq('student_id', user?.id);

      if (enrollmentsError) throw enrollmentsError;
      if (enrollmentsData) {
        setEnrollments(enrollmentsData);
        
        // Initialize simulator with actual grade points (fallback for simulation)
        const initial: Record<string, number> = {};
        enrollmentsData.forEach((e: any) => {
          const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades;
          if (grade?.grade_mappings?.grade_point !== undefined) {
            initial[e.id] = grade.grade_mappings.grade_point;
          }
        });
        setSimulatedGradePoints(initial);
      }

      // Fetch grade mappings
      const { data: mappingsData } = await supabase
        .from('grade_mappings')
        .select('*')
        .order('min_marks', { ascending: false });
      
      if (mappingsData) setGradeMappings(mappingsData as GradeMapping[]);

      // Get unique semesters
      if (enrollmentsData) {
        const uniqueSemesters = [...new Map(
          enrollmentsData.map((e: any) => [e.semester_id, e.semesters])
        ).values()];
        setSemesters(uniqueSemesters);
      }

    } catch (error) {
      console.error('Error fetching student data:', error);
      toast.error('Failed to load academic data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate semester-wise data with chronological sorting
  const getSemesterData = (): SemesterGPA[] => {
    // Sort semesters chronologically (Summer YYYY, Winter YYYY, ...)
    const sortedSemesters = sortSemestersChronologically(semesters);
    
    return sortedSemesters.map((semester: any) => {
      const semesterEnrollments = enrollments.filter(
        e => e.semester_id === semester.id
      );

      const subjects: SubjectGrade[] = semesterEnrollments.map((e: any) => {
        // Handle grades as either array or single object (one-to-one relation)
        const grade = Array.isArray(e.grades) ? e.grades[0] : e.grades;
        return {
          subjectCode: e.subjects.code,
          subjectName: e.subjects.name,
          credits: e.subjects.credits,
          marks: grade?.marks || 0,
          letterGrade: grade?.grade_mappings?.letter_grade || '-',
          gradePoint: grade?.grade_mappings?.grade_point || 0
        };
      });

      return {
        semesterId: semester.id,
        semesterName: semester.name,
        sessionName: semester.academic_sessions?.name || '',
        subjects,
        gpa: calculateGPA(subjects),
        totalCredits: subjects.reduce((sum, s) => sum + s.credits, 0),
        earnedCredits: calculateEarnedCredits(subjects)
      };
    });
  };

  const semesterData = getSemesterData();
  const allSubjects = semesterData.flatMap(s => s.subjects);
  const cgpa = calculateCGPA(semesterData);
  const totalCredits = allSubjects.reduce((sum, s) => sum + s.credits, 0);
  const earnedCredits = calculateEarnedCredits(allSubjects);
  const gpaStatus = getGPAStatus(cgpa);
  const atRisk = isAtAcademicRisk(cgpa);

  // Simulator calculations for a specific semester
  const getSimulatedSemesterGPA = (semesterId: string) => {
    const semesterEnrollments = enrollments.filter(e => e.semester_id === semesterId);
    if (semesterEnrollments.length === 0) return 0;
    
    let totalWeightedPoints = 0;
    let totalCredits = 0;
    
    semesterEnrollments.forEach((e: any) => {
      const credits = e.subjects.credits || 0;
      const actualGrade = Array.isArray(e.grades) ? e.grades[0] : e.grades;
      const gradePoint = simulatedGradePoints[e.id] ?? actualGrade?.grade_mappings?.grade_point ?? 0;
      
      totalWeightedPoints += credits * gradePoint;
      totalCredits += credits;
    });
    
    return totalCredits > 0 ? totalWeightedPoints / totalCredits : 0;
  };
  
  // Get the grade label from a grade point
  const getGradeLabelFromPoint = (gradePoint: number): string => {
    const grade = gradeOptions.find(g => g.gradePoint === gradePoint);
    return grade?.label || 'F';
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFeedback(true);

    const { error } = await supabase
      .from('feedback')
      .insert({
        student_id: user?.id,
        subject: feedback.subject,
        message: feedback.message
      });

    setSubmittingFeedback(false);

    if (error) {
      toast.error('Failed to submit feedback');
    } else {
      toast.success('Feedback submitted successfully');
      setFeedback({ subject: '', message: '' });
    }
  };

  const getGPABadgeClass = () => {
    switch (gpaStatus.color) {
      case 'excellent': return 'gpa-badge-excellent';
      case 'good': return 'gpa-badge-good';
      case 'average': return 'gpa-badge-average';
      case 'warning': return 'gpa-badge-warning';
      case 'danger': return 'gpa-badge-danger';
      default: return '';
    }
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
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Welcome, {profile?.full_name || 'Student'}
            </h2>
            <p className="text-muted-foreground">
              {profile?.student_id && `Student ID: ${profile.student_id}`}
            </p>
          </div>
          
          {atRisk && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-lg">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Academic Risk Alert</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl ugv-gradient">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{cgpa.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">CGPA</p>
                </div>
              </div>
              <Badge className={`mt-3 ${getGPABadgeClass()}`}>
                {gpaStatus.label}
              </Badge>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-100">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {semesterData.length > 0 ? semesterData[semesterData.length - 1].gpa.toFixed(2) : '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {semesterData.length > 0 
                      ? `${getOrdinal(semesterData.length)} Semester GPA`
                      : 'No semester data'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-100">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{earnedCredits}/{totalCredits}</p>
                  <p className="text-sm text-muted-foreground">Credits Earned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-100">
                  <Calculator className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{semesterData.length}</p>
                  <p className="text-sm text-muted-foreground">Semesters</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="transcript" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="insights">GPA Insights</TabsTrigger>
            <TabsTrigger value="simulator">GPA Simulator</TabsTrigger>
            <TabsTrigger value="feedback">Submit Feedback</TabsTrigger>
          </TabsList>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="space-y-4">
            {semesterData.length > 0 ? (
              <>
                {/* Semester Selection Buttons */}
                <div className="flex flex-wrap gap-2">
                  {semesterData.slice().reverse().map((semester, idx) => {
                    const semesterNumber = semesterData.length - idx;
                    const isSelected = selectedTranscriptSemester === semester.semesterId || 
                      (!selectedTranscriptSemester && idx === 0);
                    
                    return (
                      <Button
                        key={semester.semesterId}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTranscriptSemester(semester.semesterId)}
                        className="transition-all"
                      >
                        {getOrdinal(semesterNumber)} Semester – {semester.sessionName}
                      </Button>
                    );
                  })}
                </div>

                {/* Selected Semester Result */}
                {(() => {
                  const activeSemesterId = selectedTranscriptSemester || semesterData[semesterData.length - 1]?.semesterId;
                  const activeSemester = semesterData.find(s => s.semesterId === activeSemesterId);
                  const semesterIndex = semesterData.findIndex(s => s.semesterId === activeSemesterId);
                  
                  if (!activeSemester) return null;
                  
                  return (
                    <Card className="animate-in fade-in-50 duration-200">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>{getOrdinal(semesterIndex + 1)} Semester</CardTitle>
                            <CardDescription>{activeSemester.sessionName}</CardDescription>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{activeSemester.gpa.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">Semester GPA</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Code</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead className="text-center">Credits</TableHead>
                              <TableHead className="text-center">Marks</TableHead>
                              <TableHead className="text-center">Grade</TableHead>
                              <TableHead className="text-center">Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeSemester.subjects.map((subject, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono">{subject.subjectCode}</TableCell>
                                <TableCell>{subject.subjectName}</TableCell>
                                <TableCell className="text-center">{subject.credits}</TableCell>
                                <TableCell className="text-center">{subject.marks || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{subject.letterGrade}</Badge>
                                </TableCell>
                                <TableCell className="text-center">{subject.gradePoint.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="flex justify-end mt-4 gap-4 text-sm text-muted-foreground">
                          <span>Total Credits: {activeSemester.totalCredits}</span>
                          <span>Earned: {activeSemester.earnedCredits}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No academic records found</p>
                  <p className="text-sm">Your results will appear here once they are published</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* GPA Insights Tab */}
          <TabsContent value="insights">
            <GPAInsights 
              semesterData={semesterData}
              cgpa={cgpa}
              totalCredits={totalCredits}
              earnedCredits={earnedCredits}
            />
          </TabsContent>

          {/* GPA Simulator Tab */}
          <TabsContent value="simulator" className="space-y-4">
            {semesterData.length > 0 ? (
              <>
                {/* Semester Selection Buttons */}
                <div className="flex flex-wrap gap-2">
                  {semesterData.slice().reverse().map((semester, idx) => {
                    const semesterNumber = semesterData.length - idx;
                    const isSelected = selectedSimulatorSemester === semester.semesterId || 
                      (!selectedSimulatorSemester && idx === 0);
                    
                    return (
                      <Button
                        key={semester.semesterId}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSimulatorSemester(semester.semesterId)}
                        className="transition-all"
                      >
                        {getOrdinal(semesterNumber)} Semester
                      </Button>
                    );
                  })}
                </div>

                {/* Selected Semester Simulator */}
                {(() => {
                  const activeSemesterId = selectedSimulatorSemester || semesterData[semesterData.length - 1]?.semesterId;
                  const activeSemester = semesterData.find(s => s.semesterId === activeSemesterId);
                  const semesterIndex = semesterData.findIndex(s => s.semesterId === activeSemesterId);
                  const semesterEnrollments = enrollments.filter(e => e.semester_id === activeSemesterId);
                  
                  if (!activeSemester) return null;
                  
                  const simulatedGPA = getSimulatedSemesterGPA(activeSemesterId);
                  const gpaDiff = simulatedGPA - activeSemester.gpa;
                  
                  return (
                    <Card className="animate-in fade-in-50 duration-200">
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Calculator className="h-5 w-5" />
                              {getOrdinal(semesterIndex + 1)} Semester Simulator
                            </CardTitle>
                            <CardDescription>
                              {activeSemester.sessionName} • Adjust grades to see potential GPA
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Simulated GPA</p>
                            <div className="flex items-baseline gap-2">
                              <p className="text-2xl font-bold text-primary">{simulatedGPA.toFixed(2)}</p>
                              {gpaDiff !== 0 && (
                                <span className={`text-sm font-medium ${gpaDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {gpaDiff > 0 ? '+' : ''}{gpaDiff.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject</TableHead>
                              <TableHead className="text-center">Credits</TableHead>
                              <TableHead>Simulated Grade</TableHead>
                              <TableHead className="text-center">Points</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {semesterEnrollments.map((enrollment) => {
                              const actualGrade = Array.isArray(enrollment.grades) ? enrollment.grades[0] : enrollment.grades;
                              const actualGradePoint = actualGrade?.grade_mappings?.grade_point ?? 0;
                              const simulatedPoint = simulatedGradePoints[enrollment.id] ?? actualGradePoint;
                              const isSimulated = simulatedGradePoints[enrollment.id] !== undefined && 
                                                  simulatedGradePoints[enrollment.id] !== actualGradePoint;
                              
                              return (
                                <TableRow key={enrollment.id} className={isSimulated ? 'bg-primary/5' : ''}>
                                  <TableCell>
                                    <span className="font-mono text-sm text-muted-foreground">{enrollment.subjects.code}</span>
                                    <span className="ml-2">{enrollment.subjects.name}</span>
                                  </TableCell>
                                  <TableCell className="text-center">{enrollment.subjects.credits}</TableCell>
                                  <TableCell>
                                    <Select
                                      value={simulatedPoint.toFixed(2)}
                                      onValueChange={(value) => {
                                        setSimulatedGradePoints(prev => ({
                                          ...prev,
                                          [enrollment.id]: parseFloat(value)
                                        }));
                                      }}
                                    >
                                      <SelectTrigger className={`w-28 ${isSimulated ? 'border-primary' : ''}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {gradeOptions.map((grade) => (
                                          <SelectItem 
                                            key={grade.label} 
                                            value={grade.gradePoint.toFixed(2)}
                                          >
                                            {grade.label} ({grade.gradePoint.toFixed(2)})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={isSimulated ? 'default' : 'outline'}>
                                      {simulatedPoint.toFixed(2)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>

                        {semesterEnrollments.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No subjects in this semester
                          </div>
                        )}

                        <div className="flex justify-between items-center mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Credits: {activeSemester.totalCredits} • Actual GPA: {activeSemester.gpa.toFixed(2)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Reset simulated grades for this semester
                              const resetGrades = { ...simulatedGradePoints };
                              semesterEnrollments.forEach(e => {
                                delete resetGrades[e.id];
                              });
                              setSimulatedGradePoints(resetGrades);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Reset Semester
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No semester data available</p>
                  <p className="text-sm">The simulator will be available once you have enrolled subjects</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Submit Feedback
                </CardTitle>
                <CardDescription>
                  Share your concerns or suggestions with the administration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFeedbackSubmit} className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label htmlFor="feedback-subject">Subject</Label>
                    <Input
                      id="feedback-subject"
                      placeholder="e.g., Grade Query, Course Issue"
                      value={feedback.subject}
                      onChange={(e) => setFeedback({ ...feedback, subject: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="feedback-message">Message</Label>
                    <Textarea
                      id="feedback-message"
                      placeholder="Describe your feedback in detail..."
                      rows={5}
                      value={feedback.message}
                      onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={submittingFeedback}>
                    {submittingFeedback ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Submit Feedback
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
