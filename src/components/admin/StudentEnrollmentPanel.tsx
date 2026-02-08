import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X, BookOpen, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Student {
  id: string;
  full_name: string;
  student_id: string | null;
  email: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  credits: number;
}

interface Semester {
  id: string;
  name: string;
  is_locked: boolean;
  academic_sessions?: { name: string };
}

interface Enrollment {
  id: string;
  student_id: string;
  subject_id: string;
  semester_id: string;
}

interface StudentEnrollmentPanelProps {
  students: Student[];
  subjects: Subject[];
  semesters: Semester[];
  enrollments: Enrollment[];
  onEnrollmentChange: () => void;
}

export function StudentEnrollmentPanel({
  students,
  subjects,
  semesters,
  enrollments,
  onEnrollmentChange
}: StudentEnrollmentPanelProps) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Get active semesters only
  const activeSemesters = useMemo(() => 
    semesters.filter(s => !s.is_locked), 
    [semesters]
  );

  // Auto-select first semester if available
  useEffect(() => {
    if (activeSemesters.length > 0 && !selectedSemesterId) {
      setSelectedSemesterId(activeSemesters[0].id);
    }
  }, [activeSemesters, selectedSemesterId]);

  // Get current enrollments for selected student + semester
  const currentEnrollments = useMemo(() => {
    if (!selectedStudentId || !selectedSemesterId) return new Set<string>();
    return new Set(
      enrollments
        .filter(e => e.student_id === selectedStudentId && e.semester_id === selectedSemesterId)
        .map(e => e.subject_id)
    );
  }, [enrollments, selectedStudentId, selectedSemesterId]);

  // Check if subject is enrolled (considering pending changes)
  const isSubjectEnrolled = (subjectId: string): boolean => {
    if (pendingChanges.has(subjectId)) {
      return pendingChanges.get(subjectId)!;
    }
    return currentEnrollments.has(subjectId);
  };

  // Handle checkbox toggle
  const handleToggle = (subjectId: string, checked: boolean) => {
    const originalState = currentEnrollments.has(subjectId);
    
    setPendingChanges(prev => {
      const next = new Map(prev);
      if (checked === originalState) {
        // Reverted to original state, remove from pending
        next.delete(subjectId);
      } else {
        next.set(subjectId, checked);
      }
      return next;
    });
  };

  // Check if there are pending changes
  const hasPendingChanges = pendingChanges.size > 0;

  // Cancel all pending changes
  const handleCancel = () => {
    setPendingChanges(new Map());
  };

  // Save all pending changes
  const handleSave = async () => {
    if (!selectedStudentId || !selectedSemesterId) return;
    
    setIsSaving(true);
    
    try {
      const toEnroll: string[] = [];
      const toUnenroll: string[] = [];
      
      pendingChanges.forEach((shouldBeEnrolled, subjectId) => {
        const wasEnrolled = currentEnrollments.has(subjectId);
        if (shouldBeEnrolled && !wasEnrolled) {
          toEnroll.push(subjectId);
        } else if (!shouldBeEnrolled && wasEnrolled) {
          toUnenroll.push(subjectId);
        }
      });

      // Process enrollments
      if (toEnroll.length > 0) {
        const { error } = await supabase
          .from('enrollments')
          .insert(toEnroll.map(subjectId => ({
            student_id: selectedStudentId,
            subject_id: subjectId,
            semester_id: selectedSemesterId
          })));
        
        if (error) throw error;
      }

      // Process unenrollments
      if (toUnenroll.length > 0) {
        const { error } = await supabase
          .from('enrollments')
          .delete()
          .eq('student_id', selectedStudentId)
          .eq('semester_id', selectedSemesterId)
          .in('subject_id', toUnenroll);
        
        if (error) throw error;
      }

      toast.success(`Enrollment updated: ${toEnroll.length} added, ${toUnenroll.length} removed`);
      setPendingChanges(new Map());
      onEnrollmentChange();
    } catch (error: any) {
      console.error('Error saving enrollments:', error);
      toast.error('Failed to save enrollments: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset pending changes when student or semester changes
  useEffect(() => {
    setPendingChanges(new Map());
  }, [selectedStudentId, selectedSemesterId]);

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const enrolledCount = subjects.filter(s => isSubjectEnrolled(s.id)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel: Student & Semester Selector */}
      <Card className="lg:col-span-1 bg-card border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Select Student
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Student</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Choose a student..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{student.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {student.student_id || student.email}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {students.length === 0 && (
              <p className="text-xs text-muted-foreground">No students registered</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Semester</Label>
            <Select value={selectedSemesterId} onValueChange={setSelectedSemesterId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Choose semester..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {activeSemesters.map(semester => (
                  <SelectItem key={semester.id} value={semester.id}>
                    <div className="flex flex-col items-start">
                      <span>{semester.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(semester as any).academic_sessions?.name}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeSemesters.length === 0 && (
              <p className="text-xs text-muted-foreground">No active semesters</p>
            )}
          </div>

          {selectedStudent && (
            <div className="pt-4 border-t border-border/50">
              <div className="rounded-lg bg-accent/50 p-3">
                <p className="text-sm font-medium">{selectedStudent.full_name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {selectedStudent.student_id || 'No ID'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {enrolledCount} subject{enrolledCount !== 1 ? 's' : ''} enrolled
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right Panel: Subject Assignment List */}
      <Card className="lg:col-span-2 bg-card border-border/50">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Subject Enrollment
          </CardTitle>
          {hasPendingChanges && (
            <Badge variant="outline" className="text-xs bg-accent/50">
              {pendingChanges.size} pending change{pendingChanges.size !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedStudentId ? (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground text-sm">
              Select a student to manage enrollments
            </div>
          ) : (
            <>
              <ScrollArea className="h-[360px] pr-4">
                <div className="space-y-1">
                  {subjects.map(subject => {
                    const isEnrolled = isSubjectEnrolled(subject.id);
                    const hasChange = pendingChanges.has(subject.id);
                    
                    return (
                      <label
                        key={subject.id}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg cursor-pointer
                          transition-colors duration-150
                          ${isEnrolled ? 'bg-accent/60' : 'bg-background hover:bg-muted/50'}
                          ${hasChange ? 'ring-1 ring-primary/30' : ''}
                        `}
                      >
                        <Checkbox
                          checked={isEnrolled}
                          onCheckedChange={(checked) => handleToggle(subject.id, checked as boolean)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono shrink-0">
                              {subject.code}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {subject.name}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {subject.credits} credit{subject.credits !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {hasChange && (
                          <Badge 
                            variant={isEnrolled ? 'default' : 'secondary'} 
                            className="text-xs shrink-0"
                          >
                            {isEnrolled ? 'Adding' : 'Removing'}
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                  {subjects.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No subjects available
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={!hasPendingChanges || isSaving}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasPendingChanges || isSaving}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Enrollment
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
