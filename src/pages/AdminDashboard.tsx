import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, BookOpen, Calendar, GraduationCap, Settings, 
  Plus, Lock, Unlock, Loader2, CheckCircle, UserPlus, Trash2, Star, Database
} from 'lucide-react';
import { toast } from 'sonner';
import { AppRole } from '@/lib/supabase-types';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    activeSemesters: 0
  });
  
  const [users, setUsers] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [gradeMappings, setGradeMappings] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  
  // Form states
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', credits: 3 });
  const [sessionForm, setSessionForm] = useState({ name: '', start_date: '', end_date: '' });
  const [semesterForm, setSemesterForm] = useState({ name: '', academic_session_id: '', start_date: '', end_date: '' });
  const [teacherAssignmentForm, setTeacherAssignmentForm] = useState({ teacher_id: '', subject_id: '', semester_id: '' });
  const [enrollmentForm, setEnrollmentForm] = useState({ student_id: '', subject_id: '', semester_id: '' });
  const [createUserForm, setCreateUserForm] = useState({ 
    email: '', 
    password: '', 
    full_name: '', 
    role: 'student' as AppRole, 
    student_id: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch users with roles - the query uses a JOIN via foreign key
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*, user_roles(role)');
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast.error('Failed to load user profiles');
      } else if (profiles) {
        console.log('Fetched profiles:', profiles.length);
        setUsers(profiles);
        // Filter teachers and students based on role
        setTeachers(profiles.filter((p: any) => p.user_roles?.some((r: any) => r.role === 'teacher')));
        setStudents(profiles.filter((p: any) => p.user_roles?.some((r: any) => r.role === 'student')));
      }

      // Count students and teachers
      const { count: studentCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      const { count: teacherCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher');

      // Fetch subjects
      const { data: subjectsData } = await supabase
        .from('subjects')
        .select('*')
        .order('code');
      
      if (subjectsData) setSubjects(subjectsData);

      // Fetch sessions
      const { data: sessionsData } = await supabase
        .from('academic_sessions')
        .select('*')
        .order('start_date', { ascending: false });
      
      if (sessionsData) setSessions(sessionsData);

      // Fetch semesters
      const { data: semestersData } = await supabase
        .from('semesters')
        .select('*, academic_sessions(name)')
        .order('start_date', { ascending: false });
      
      if (semestersData) setSemesters(semestersData);

      // Fetch grade mappings
      const { data: gradesData } = await supabase
        .from('grade_mappings')
        .select('*')
        .order('min_marks', { ascending: false });
      
      if (gradesData) setGradeMappings(gradesData);

      // Fetch feedback
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });
      
      if (feedbackData) setFeedback(feedbackData);

      // Fetch teacher assignments
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select('*, profiles(full_name, email), subjects(code, name), semesters(name, academic_sessions(name))')
        .order('created_at', { ascending: false });
      
      if (assignmentsData) setTeacherAssignments(assignmentsData);

      // Fetch enrollments
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select('*, profiles(full_name, student_id, email), subjects(code, name), semesters(name, academic_sessions(name))')
        .order('created_at', { ascending: false });
      
      if (enrollmentsData) setEnrollments(enrollmentsData);

      setStats({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        totalSubjects: subjectsData?.length || 0,
        activeSemesters: semestersData?.filter(s => !s.is_locked).length || 0
      });

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('admin-create-user', {
        body: createUserForm
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create user');
      }

      if (response.data?.error) {
        toast.error(response.data.message || 'Failed to create user');
      } else {
        toast.success(`User ${createUserForm.email} created successfully`);
        setCreateUserForm({ email: '', password: '', full_name: '', role: 'student', student_id: '' });
        setCreateUserDialogOpen(false);
        fetchAllData();
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('subjects')
      .insert(subjectForm);
    
    setIsSubmitting(false);
    
    if (error) {
      toast.error('Failed to add subject: ' + error.message);
    } else {
      toast.success('Subject added successfully');
      setSubjectForm({ code: '', name: '', credits: 3 });
      fetchAllData();
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('academic_sessions')
      .insert(sessionForm);
    
    setIsSubmitting(false);
    
    if (error) {
      toast.error('Failed to add session: ' + error.message);
    } else {
      toast.success('Academic session added successfully');
      setSessionForm({ name: '', start_date: '', end_date: '' });
      fetchAllData();
    }
  };

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('semesters')
      .insert(semesterForm);
    
    setIsSubmitting(false);
    
    if (error) {
      toast.error('Failed to add semester: ' + error.message);
    } else {
      toast.success('Semester added successfully');
      setSemesterForm({ name: '', academic_session_id: '', start_date: '', end_date: '' });
      fetchAllData();
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('teacher_assignments')
      .insert(teacherAssignmentForm);
    
    setIsSubmitting(false);
    
    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error('This teacher is already assigned to this subject for this semester');
      } else {
        toast.error('Failed to assign teacher: ' + error.message);
      }
    } else {
      toast.success('Teacher assigned successfully');
      setTeacherAssignmentForm({ teacher_id: '', subject_id: '', semester_id: '' });
      fetchAllData();
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('enrollments')
      .insert(enrollmentForm);
    
    setIsSubmitting(false);
    
    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error('This student is already enrolled in this subject for this semester');
      } else {
        toast.error('Failed to enroll student: ' + error.message);
      }
    } else {
      toast.success('Student enrolled successfully');
      setEnrollmentForm({ student_id: '', subject_id: '', semester_id: '' });
      fetchAllData();
    }
  };

  const handleRemoveTeacherAssignment = async (assignmentId: string) => {
    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('id', assignmentId);
    
    if (error) {
      toast.error('Failed to remove assignment');
    } else {
      toast.success('Assignment removed');
      fetchAllData();
    }
  };

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', enrollmentId);
    
    if (error) {
      toast.error('Failed to remove enrollment');
    } else {
      toast.success('Enrollment removed');
      fetchAllData();
    }
  };

  const toggleSemesterLock = async (semesterId: string, currentLock: boolean) => {
    const { error } = await supabase
      .from('semesters')
      .update({ is_locked: !currentLock })
      .eq('id', semesterId);
    
    if (error) {
      toast.error('Failed to update semester');
    } else {
      toast.success(currentLock ? 'Semester unlocked' : 'Semester locked');
      fetchAllData();
    }
  };

  const setActiveSession = async (sessionId: string) => {
    // First, set all sessions to inactive
    const { error: deactivateError } = await supabase
      .from('academic_sessions')
      .update({ is_active: false })
      .neq('id', sessionId);
    
    if (deactivateError) {
      toast.error('Failed to update sessions');
      return;
    }

    // Then, set the selected session to active
    const { error } = await supabase
      .from('academic_sessions')
      .update({ is_active: true })
      .eq('id', sessionId);
    
    if (error) {
      toast.error('Failed to set active session');
    } else {
      toast.success('Active session updated');
      fetchAllData();
    }
  };

  const resolveFeedback = async (feedbackId: string) => {
    const { error } = await supabase
      .from('feedback')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', feedbackId);
    
    if (error) {
      toast.error('Failed to resolve feedback');
    } else {
      toast.success('Feedback marked as resolved');
      fetchAllData();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Note: This only deletes from profiles table; auth user remains
    // Full deletion would require service role key via edge function
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (error) {
      toast.error('Failed to delete user: ' + error.message);
    } else {
      toast.success('User removed from system');
      fetchAllData();
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('seed-academic-data', {
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to seed data');
      }

      if (response.data?.error) {
        toast.error(response.data.message || 'Failed to seed data');
      } else {
        const result = response.data.result;
        const totalCreated = result.enrollments_created + result.teacher_assignments_created + 
                            result.grades_created + result.feedback_created;
        
        if (totalCreated === 0) {
          toast.info('Data already seeded! All enrollments, grades, and assignments are in place.');
        } else {
          toast.success(
            `Seeding complete! Created: ${result.enrollments_created} enrollments, ` +
            `${result.teacher_assignments_created} assignments, ${result.grades_created} grades, ` +
            `${result.feedback_created} feedback entries`
          );
        }
        fetchAllData();
      }
    } catch (error: any) {
      console.error('Seeding error:', error);
      toast.error(error.message || 'Failed to seed data');
    } finally {
      setIsSeeding(false);
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
            <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
            <p className="text-muted-foreground">Manage the academic system</p>
          </div>
          <Button 
            onClick={handleSeedData} 
            disabled={isSeeding}
            variant="outline"
            className="gap-2"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {isSeeding ? 'Seeding...' : 'Seed Demo Data'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTeachers}</p>
                  <p className="text-sm text-muted-foreground">Teachers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalSubjects}</p>
                  <p className="text-sm text-muted-foreground">Subjects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeSemesters}</p>
                  <p className="text-sm text-muted-foreground">Active Semesters</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="semesters">Semesters</TabsTrigger>
            <TabsTrigger value="teachers">Teacher Assignments</TabsTrigger>
            <TabsTrigger value="enrollments">Student Enrollments</TabsTrigger>
            <TabsTrigger value="grades">Grade Mapping</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">User Management</h3>
                <p className="text-sm text-muted-foreground">Create and manage students, teachers, and admins</p>
              </div>
              <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Create a new user account with assigned role</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input 
                        placeholder="John Doe" 
                        value={createUserForm.full_name}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input 
                        type="email"
                        placeholder="user@university.edu" 
                        value={createUserForm.email}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input 
                        type="password"
                        placeholder="Min 6 characters" 
                        value={createUserForm.password}
                        onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select 
                        value={createUserForm.role}
                        onValueChange={(v: AppRole) => setCreateUserForm({ ...createUserForm, role: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {createUserForm.role === 'student' && (
                      <div className="space-y-2">
                        <Label>Student ID</Label>
                        <Input 
                          placeholder="e.g., 2024001234" 
                          value={createUserForm.student_id}
                          onChange={(e) => setCreateUserForm({ ...createUserForm, student_id: e.target.value })}
                          required
                        />
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Create User
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {(user as any).user_roles?.[0]?.role || 'No role'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{user.student_id || '-'}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No users registered yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Subjects Tab */}
          <TabsContent value="subjects" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Manage Subjects</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Subject</DialogTitle>
                    <DialogDescription>Create a new subject for the curriculum</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSubject} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subject Code</Label>
                      <Input 
                        placeholder="CS101" 
                        value={subjectForm.code}
                        onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject Name</Label>
                      <Input 
                        placeholder="Introduction to Computer Science" 
                        value={subjectForm.name}
                        onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Credits</Label>
                      <Input 
                        type="number" 
                        min="1" 
                        max="6"
                        value={subjectForm.credits}
                        onChange={(e) => setSubjectForm({ ...subjectForm, credits: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Add Subject
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-mono">{subject.code}</TableCell>
                      <TableCell>{subject.name}</TableCell>
                      <TableCell>{subject.credits}</TableCell>
                    </TableRow>
                  ))}
                  {subjects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No subjects yet. Add your first subject!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Academic Sessions</h3>
                <p className="text-sm text-muted-foreground">Manage academic years and set the active session</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Academic Session</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddSession} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Session Name</Label>
                      <Input 
                        placeholder="2024-2025" 
                        value={sessionForm.name}
                        onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input 
                          type="date" 
                          value={sessionForm.start_date}
                          onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input 
                          type="date" 
                          value={sessionForm.end_date}
                          onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      Add Session
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {session.is_active ? (
                          <Badge className="bg-primary">
                            <Star className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!session.is_active && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setActiveSession(session.id)}
                          >
                            <Star className="h-4 w-4 mr-1" />
                            Set Active
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No academic sessions yet. Add your first session!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Semesters Tab */}
          <TabsContent value="semesters" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Semesters</h3>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Semester
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Semester</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAddSemester} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Academic Session</Label>
                      <Select 
                        value={semesterForm.academic_session_id}
                        onValueChange={(v) => setSemesterForm({ ...semesterForm, academic_session_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select session" />
                        </SelectTrigger>
                        <SelectContent>
                          {sessions.map(session => (
                            <SelectItem key={session.id} value={session.id}>
                              {session.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Semester Name</Label>
                      <Input 
                        placeholder="Fall 2024" 
                        value={semesterForm.name}
                        onChange={(e) => setSemesterForm({ ...semesterForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input 
                          type="date" 
                          value={semesterForm.start_date}
                          onChange={(e) => setSemesterForm({ ...semesterForm, start_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date</Label>
                        <Input 
                          type="date" 
                          value={semesterForm.end_date}
                          onChange={(e) => setSemesterForm({ ...semesterForm, end_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      Add Semester
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {semesters.map((semester) => (
                    <TableRow key={semester.id}>
                      <TableCell>{(semester as any).academic_sessions?.name}</TableCell>
                      <TableCell className="font-medium">{semester.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(semester.start_date).toLocaleDateString()} - {new Date(semester.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={semester.is_locked ? "secondary" : "default"}>
                          {semester.is_locked ? 'Locked' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toggleSemesterLock(semester.id, semester.is_locked)}
                        >
                          {semester.is_locked ? (
                            <><Unlock className="h-4 w-4 mr-1" /> Unlock</>
                          ) : (
                            <><Lock className="h-4 w-4 mr-1" /> Lock</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {semesters.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No semesters yet. Create an academic session first!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Teacher Assignments Tab */}
          <TabsContent value="teachers" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Teacher Assignments</h3>
                <p className="text-sm text-muted-foreground">Assign teachers to subjects for specific semesters</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Teacher to Subject</DialogTitle>
                    <DialogDescription>Select a teacher, subject, and semester</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAssignTeacher} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Teacher</Label>
                      <Select 
                        value={teacherAssignmentForm.teacher_id}
                        onValueChange={(v) => setTeacherAssignmentForm({ ...teacherAssignmentForm, teacher_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map(teacher => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.full_name} ({teacher.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {teachers.length === 0 && (
                        <p className="text-xs text-muted-foreground">No teachers registered yet</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select 
                        value={teacherAssignmentForm.subject_id}
                        onValueChange={(v) => setTeacherAssignmentForm({ ...teacherAssignmentForm, subject_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(subject => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.code} - {subject.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <Select 
                        value={teacherAssignmentForm.semester_id}
                        onValueChange={(v) => setTeacherAssignmentForm({ ...teacherAssignmentForm, semester_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map(semester => (
                            <SelectItem key={semester.id} value={semester.id}>
                              {semester.name} ({(semester as any).academic_sessions?.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting || !teacherAssignmentForm.teacher_id || !teacherAssignmentForm.subject_id || !teacherAssignmentForm.semester_id}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Assign Teacher
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{assignment.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{assignment.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{assignment.subjects?.code}</Badge>
                        <span className="ml-2">{assignment.subjects?.name}</span>
                      </TableCell>
                      <TableCell>{assignment.semesters?.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {(assignment.semesters as any)?.academic_sessions?.name}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveTeacherAssignment(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {teacherAssignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No teacher assignments yet. Assign teachers to subjects above!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Student Enrollments Tab */}
          <TabsContent value="enrollments" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Student Enrollments</h3>
                <p className="text-sm text-muted-foreground">Enroll students in subjects for specific semesters</p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Enroll Student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Enroll Student in Subject</DialogTitle>
                    <DialogDescription>Select a student, subject, and semester</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEnrollStudent} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Student</Label>
                      <Select 
                        value={enrollmentForm.student_id}
                        onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, student_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select student" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map(student => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.full_name} ({student.student_id || student.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {students.length === 0 && (
                        <p className="text-xs text-muted-foreground">No students registered yet</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Select 
                        value={enrollmentForm.subject_id}
                        onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, subject_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map(subject => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.code} - {subject.name} ({subject.credits} credits)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Semester</Label>
                      <Select 
                        value={enrollmentForm.semester_id}
                        onValueChange={(v) => setEnrollmentForm({ ...enrollmentForm, semester_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.filter(s => !s.is_locked).map(semester => (
                            <SelectItem key={semester.id} value={semester.id}>
                              {semester.name} ({(semester as any).academic_sessions?.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Only active (unlocked) semesters are shown</p>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isSubmitting || !enrollmentForm.student_id || !enrollmentForm.subject_id || !enrollmentForm.semester_id}
                    >
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Enroll Student
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{enrollment.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{enrollment.profiles?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{enrollment.profiles?.student_id || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{enrollment.subjects?.code}</Badge>
                        <span className="ml-2">{enrollment.subjects?.name}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{enrollment.semesters?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(enrollment.semesters as any)?.academic_sessions?.name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveEnrollment(enrollment.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {enrollments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No student enrollments yet. Enroll students in subjects above!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Grade Mapping Tab */}
          <TabsContent value="grades" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Grade Point Scale</h3>
              <Badge variant="outline" className="gap-1">
                <Settings className="h-3 w-3" />
                Editable by Admin
              </Badge>
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Letter Grade</TableHead>
                    <TableHead>Grade Point</TableHead>
                    <TableHead>Marks Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradeMappings.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell className="font-bold">{grade.letter_grade}</TableCell>
                      <TableCell>{Number(grade.grade_point).toFixed(2)}</TableCell>
                      <TableCell>{grade.min_marks} - {grade.max_marks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* Feedback Tab */}
          <TabsContent value="feedback" className="space-y-4">
            <h3 className="text-lg font-semibold">Student Feedback</h3>
            <div className="grid gap-4">
              {feedback.map((item) => (
                <Card key={item.id} className={item.status === 'resolved' ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{item.subject}</CardTitle>
                        <CardDescription>
                          From: {(item as any).profiles?.full_name} ({(item as any).profiles?.email})
                        </CardDescription>
                      </div>
                      <Badge variant={item.status === 'resolved' ? 'secondary' : 'default'}>
                        {item.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-3">{item.message}</p>
                    {item.status !== 'resolved' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => resolveFeedback(item.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark Resolved
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {feedback.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No feedback submitted yet
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
