import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/lib/supabase-types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();

  // CRITICAL: Wait for auth to fully resolve before any redirects
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Only redirect to auth if loading is complete AND no user
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Wait for role to be loaded before checking role-based access
  // If user exists but role is still null, show loading
  if (allowedRoles && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard based on role
    switch (role) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'teacher':
        return <Navigate to="/teacher" replace />;
      case 'student':
        return <Navigate to="/student" replace />;
      default:
        return <Navigate to="/auth" replace />;
    }
  }

  return <>{children}</>;
};
