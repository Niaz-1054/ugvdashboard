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
  Plus, Lock, Unlock, Loader2, AlertCircle, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    activeSemesters: 0
  });
  
  const [users, setUsers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [gradeMappings, setGradeMappings] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  
  // Form states
  const [subjectForm, setSubjectForm] = useState({ code: '', name: '', credits: 3 });
  const [sessionForm, setSessionForm] = useState({ name: '', start_date: '', end_date: '' });
  const [semesterForm, setSemesterForm] = useState({ name: '', academic_session_id: '', start_date: '', end_date: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch users with roles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*, user_roles(role)');
      
      if (profiles) setUsers(profiles);

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
          <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage the academic system</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
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
                <div className="p-3 rounded-xl bg-purple-100">
                  <GraduationCap className="h-6 w-6 text-purple-600" />
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
                <div className="p-3 rounded-xl bg-green-100">
                  <BookOpen className="h-6 w-6 text-green-600" />
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
                <div className="p-3 rounded-xl bg-amber-100">
                  <Calendar className="h-6 w-6 text-amber-600" />
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
        <Tabs defaultValue="subjects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="subjects">Subjects</TabsTrigger>
            <TabsTrigger value="semesters">Semesters</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="grades">Grade Mapping</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
          </TabsList>

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

          {/* Semesters Tab */}
          <TabsContent value="semesters" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Academic Sessions & Semesters</h3>
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
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

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <h3 className="text-lg font-semibold">Registered Users</h3>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Student ID</TableHead>
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
                      <TableCell>{user.student_id || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No users registered yet
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
