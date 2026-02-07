import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/lib/supabase-types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole, studentId?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkAdminExists: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch user data and return the role (for proper sequencing)
  const fetchUserData = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      // Fetch profile and role in parallel
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
      }

      if (roleResult.data) {
        const userRole = roleResult.data.role as AppRole;
        setRole(userRole);
        return userRole;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          // Wait for role to be fetched before setting loading to false
          await fetchUserData(currentSession.user.id);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        
        // Only process after initial load to avoid race conditions
        if (!initialized && event !== 'INITIAL_SESSION') return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            if (isMounted) {
              await fetchUserData(newSession.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
      }
    );

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData, initialized]);

  // Check if any admin exists (for bootstrap logic)
  const checkAdminExists = async (): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
      
      if (error) {
        console.error('Error checking admin existence:', error);
        return true; // Assume admin exists on error (safer)
      }
      
      return (count ?? 0) > 0;
    } catch (error) {
      console.error('Error checking admin existence:', error);
      return true;
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    fullName: string, 
    role: AppRole,
    studentId?: string
  ): Promise<{ error: Error | null }> => {
    try {
      // Use the edge function for signup to bypass RLS issues
      const response = await supabase.functions.invoke('signup-user', {
        body: {
          email,
          password,
          full_name: fullName,
          role,
          student_id: studentId
        }
      });

      if (response.error) {
        return { error: new Error(response.error.message || 'Signup failed') };
      }

      if (response.data?.error) {
        return { error: new Error(response.data.message || 'Signup failed') };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      loading,
      signUp,
      signIn,
      signOut,
      checkAdminExists
    }}>
      {children}
    </AuthContext.Provider>
  );
};
