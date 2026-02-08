import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X, BookOpen, GraduationCap, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Teacher {
  id: string;
  full_name: string;
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

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  subject_id: string;
  semester_id: string;
}

interface TeacherAssignmentPanelProps {
  teachers: Teacher[];
  subjects: Subject[];
  semesters: Semester[];
  assignments: TeacherAssignment[];
  onAssignmentChange: () => void;
}

export function TeacherAssignmentPanel({
  teachers,
  subjects,
  semesters,
  assignments,
  onAssignmentChange
}: TeacherAssignmentPanelProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Get active semesters only
  const activeSemesters = useMemo(() => 
    semesters.filter(s => !s.is_locked), 
    [semesters]
  );

  // Filter teachers by search query
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter(t => 
      t.full_name.toLowerCase().includes(query) ||
      t.email.toLowerCase().includes(query)
    );
  }, [teachers, searchQuery]);

  // Auto-select first semester if available
  useEffect(() => {
    if (activeSemesters.length > 0 && !selectedSemesterId) {
      setSelectedSemesterId(activeSemesters[0].id);
    }
  }, [activeSemesters, selectedSemesterId]);

  // Get current assignments for selected teacher + semester
  const currentAssignments = useMemo(() => {
    if (!selectedTeacherId || !selectedSemesterId) return new Set<string>();
    return new Set(
      assignments
        .filter(a => a.teacher_id === selectedTeacherId && a.semester_id === selectedSemesterId)
        .map(a => a.subject_id)
    );
  }, [assignments, selectedTeacherId, selectedSemesterId]);

  // Check if subject is assigned (considering pending changes)
  const isSubjectAssigned = (subjectId: string): boolean => {
    if (pendingChanges.has(subjectId)) {
      return pendingChanges.get(subjectId)!;
    }
    return currentAssignments.has(subjectId);
  };

  // Handle checkbox toggle
  const handleToggle = (subjectId: string, checked: boolean) => {
    const originalState = currentAssignments.has(subjectId);
    
    setPendingChanges(prev => {
      const next = new Map(prev);
      if (checked === originalState) {
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
    if (!selectedTeacherId || !selectedSemesterId) return;
    
    setIsSaving(true);
    
    try {
      const toAssign: string[] = [];
      const toUnassign: string[] = [];
      
      pendingChanges.forEach((shouldBeAssigned, subjectId) => {
        const wasAssigned = currentAssignments.has(subjectId);
        if (shouldBeAssigned && !wasAssigned) {
          toAssign.push(subjectId);
        } else if (!shouldBeAssigned && wasAssigned) {
          toUnassign.push(subjectId);
        }
      });

      // Process new assignments
      if (toAssign.length > 0) {
        const { error } = await supabase
          .from('teacher_assignments')
          .insert(toAssign.map(subjectId => ({
            teacher_id: selectedTeacherId,
            subject_id: subjectId,
            semester_id: selectedSemesterId
          })));
        
        if (error) throw error;
      }

      // Process removals
      if (toUnassign.length > 0) {
        const { error } = await supabase
          .from('teacher_assignments')
          .delete()
          .eq('teacher_id', selectedTeacherId)
          .eq('semester_id', selectedSemesterId)
          .in('subject_id', toUnassign);
        
        if (error) throw error;
      }

      toast.success(`Assignments updated: ${toAssign.length} added, ${toUnassign.length} removed`);
      setPendingChanges(new Map());
      onAssignmentChange();
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      toast.error('Failed to save assignments: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset pending changes when teacher or semester changes
  useEffect(() => {
    setPendingChanges(new Map());
  }, [selectedTeacherId, selectedSemesterId]);

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const assignedCount = subjects.filter(s => isSubjectAssigned(s.id)).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel: Teacher Selector with Search */}
      <Card className="lg:col-span-1 bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            Select Teacher
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          {/* Teacher List */}
          <ScrollArea className="h-[240px]">
            <div className="space-y-1">
              {filteredTeachers.map(teacher => (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => setSelectedTeacherId(teacher.id)}
                  className={`
                    w-full text-left p-3 rounded-lg transition-colors duration-150
                    ${selectedTeacherId === teacher.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-background hover:bg-muted/50'
                    }
                  `}
                >
                  <p className="text-sm font-medium truncate">{teacher.full_name}</p>
                  <p className={`text-xs truncate ${
                    selectedTeacherId === teacher.id 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {teacher.email}
                  </p>
                </button>
              ))}
              {filteredTeachers.length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {searchQuery ? 'No teachers found' : 'No teachers registered'}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Semester Selector */}
          <div className="space-y-2 pt-2 border-t border-border/50">
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

          {/* Selected Teacher Summary */}
          {selectedTeacher && (
            <div className="rounded-lg bg-accent/50 p-3">
              <p className="text-sm font-medium">{selectedTeacher.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedTeacher.email}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {assignedCount} subject{assignedCount !== 1 ? 's' : ''} assigned
                </Badge>
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
            Subject Assignments
          </CardTitle>
          {hasPendingChanges && (
            <Badge variant="outline" className="text-xs bg-accent/50">
              {pendingChanges.size} pending change{pendingChanges.size !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedTeacherId ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground text-sm">
              Select a teacher to manage subject assignments
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-1">
                  {subjects.map(subject => {
                    const isAssigned = isSubjectAssigned(subject.id);
                    const hasChange = pendingChanges.has(subject.id);
                    
                    return (
                      <label
                        key={subject.id}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg cursor-pointer
                          transition-colors duration-150
                          ${isAssigned ? 'bg-accent/60' : 'bg-background hover:bg-muted/50'}
                          ${hasChange ? 'ring-1 ring-primary/30' : ''}
                        `}
                      >
                        <Checkbox
                          checked={isAssigned}
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
                            variant={isAssigned ? 'default' : 'secondary'} 
                            className="text-xs shrink-0"
                          >
                            {isAssigned ? 'Adding' : 'Removing'}
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
                  Save Assignments
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
