import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, Loader2, AlertCircle } from 'lucide-react';
import { AppRole } from '@/lib/supabase-types';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'teacher', 'student']),
  studentId: z.string().optional()
});

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, signUp, role } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (role) {
    switch (role) {
      case 'admin':
        navigate('/admin', { replace: true });
        break;
      case 'teacher':
        navigate('/teacher', { replace: true });
        break;
      case 'student':
        navigate('/student', { replace: true });
        break;
    }
  }

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'student' as AppRole,
    studentId: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const validation = loginSchema.safeParse(loginForm);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please verify your email before signing in.');
      } else {
        setError(error.message);
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const validation = signupSchema.safeParse(signupForm);
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    if (signupForm.role === 'student' && !signupForm.studentId) {
      setError('Student ID is required for student accounts');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(
      signupForm.email,
      signupForm.password,
      signupForm.fullName,
      signupForm.role,
      signupForm.studentId || undefined
    );
    setIsLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please sign in instead.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('Account created! Please check your email to verify your account.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl ugv-gradient mb-4">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">UGV Academic Portal</h1>
          <p className="text-muted-foreground mt-1">University of Global Village</p>
        </div>

        <Card className="border-0 shadow-xl">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader className="pb-4">
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Sign in to access your dashboard</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@university.edu"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="signup">
              <CardHeader className="pb-4">
                <CardTitle>Create an account</CardTitle>
                <CardDescription>Register for the academic portal</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignup} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                  
                  {success && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {success}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupForm.fullName}
                      onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@university.edu"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Role</Label>
                    <Select
                      value={signupForm.role}
                      onValueChange={(value: AppRole) => setSignupForm({ ...signupForm, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {signupForm.role === 'student' && (
                    <div className="space-y-2">
                      <Label htmlFor="signup-student-id">Student ID</Label>
                      <Input
                        id="signup-student-id"
                        type="text"
                        placeholder="e.g., 2024001234"
                        value={signupForm.studentId}
                        onChange={(e) => setSignupForm({ ...signupForm, studentId: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          GPA & Result Analytics System
        </p>
      </div>
    </div>
  );
}
