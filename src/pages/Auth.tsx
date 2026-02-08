import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GraduationCap, Loader2, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
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
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { signIn, signUp, user, role, loading, checkAdminExists } = useAuth();
  const navigate = useNavigate();

  // Check if admin exists on mount (for bootstrap logic)
  useEffect(() => {
    const checkAdmin = async () => {
      setCheckingAdmin(true);
      const exists = await checkAdminExists();
      setAdminExists(exists);
      setCheckingAdmin(false);
    };
    checkAdmin();
  }, [checkAdminExists]);

  // Redirect if already logged in (ONLY after auth has fully resolved)
  useEffect(() => {
    if (loading) return;
    if (!user || !role) return;

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
  }, [loading, user, role, navigate]);

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

    // Block admin signup if admin already exists
    if (signupForm.role === 'admin' && adminExists) {
      setError('An admin account already exists. Please contact your administrator to create additional admin accounts.');
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
      if (error.message.includes('already') || error.message.includes('Conflict')) {
        setError('This email is already registered. Please sign in instead.');
      } else if (error.message.includes('Forbidden') || error.message.includes('admin')) {
        setError('An admin account already exists. Only existing admins can create new admin accounts.');
      } else {
        setError(error.message);
      }
    } else {
      if (signupForm.role === 'admin') {
        setSuccess('Admin account created successfully! You can now sign in.');
      } else {
        setSuccess('Account created successfully! You can now sign in.');
      }
      // Reset form
      setSignupForm({
        email: '',
        password: '',
        fullName: '',
        role: 'student',
        studentId: ''
      });
    }
  };

  // Get available roles based on admin existence
  const getAvailableRoles = () => {
    if (checkingAdmin) return [];
    
    // If no admin exists, only allow admin signup (bootstrap)
    if (!adminExists) {
      return [{ value: 'admin', label: 'Admin (First Setup)' }];
    }
    
    // If admin exists, only allow student/teacher signup via admin
    return [
      { value: 'student', label: 'Student' },
      { value: 'teacher', label: 'Teacher' }
    ];
  };

  const availableRoles = getAvailableRoles();

  // Set default role based on available roles
  useEffect(() => {
    if (!checkingAdmin && availableRoles.length > 0) {
      setSignupForm(prev => ({
        ...prev,
        role: availableRoles[0].value as AppRole
      }));
    }
  }, [checkingAdmin, adminExists]);

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
                <CardTitle>
                  {!adminExists && !checkingAdmin ? (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      First-Time Setup
                    </span>
                  ) : (
                    'Create an account'
                  )}
                </CardTitle>
                <CardDescription>
                  {!adminExists && !checkingAdmin 
                    ? 'Create the first admin account to initialize the system'
                    : 'Register for the academic portal'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checkingAdmin ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <form onSubmit={handleSignup} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}
                    
                    {success && (
                      <div className="flex items-center gap-2 p-3 bg-accent text-accent-foreground rounded-lg text-sm border border-primary/20">
                        <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" />
                        {success}
                      </div>
                    )}

                    {!adminExists && (
                      <div className="p-3 bg-primary/10 text-primary rounded-lg text-sm">
                        <p className="font-medium">Welcome to Initial Setup</p>
                        <p className="text-xs mt-1 opacity-80">
                          No admin account exists. Create one to get started. After this, only admins can create new accounts.
                        </p>
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

                    {adminExists && (
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
                            {availableRoles.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Note: Admin accounts can only be created by existing admins.
                        </p>
                      </div>
                    )}

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
                          {!adminExists ? 'Initializing System...' : 'Creating account...'}
                        </>
                      ) : (
                        !adminExists ? 'Create Admin Account' : 'Create Account'
                      )}
                    </Button>
                  </form>
                )}
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
