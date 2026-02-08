import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile } from '@/lib/supabase-types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  token: string | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    studentId?: string
  ) => Promise<{ error: Error | null }>;
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
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  // Split loading so we never mark the app as "ready" until BOTH session hydration and role/profile fetch are done.
  const [authLoading, setAuthLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(false);

  const loading = useMemo(() => authLoading || userDataLoading, [authLoading, userDataLoading]);

  // Fetch user data and return the role (for proper sequencing)
  const fetchUserData = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
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
      } else {
        setProfile(null);
      }

      if (roleResult.data) {
        const userRole = roleResult.data.role as AppRole;
        setRole(userRole);
        return userRole;
      }

      setRole(null);
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      setProfile(null);
      setRole(null);
      return null;
    }
  }, []);

  // 1) Subscribe to auth changes (synchronous callback only)
  // 2) Hydrate initial session on mount
  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      const accessToken = newSession?.access_token ?? null;
      setToken(accessToken);

      // Mirror the access token for demo/debug purposes; Supabase session persistence remains the source of truth.
      if (accessToken) {
        localStorage.setItem('token', accessToken);
      } else {
        localStorage.removeItem('token');
      }
    });

    const hydrate = async () => {
      setAuthLoading(true);
      try {
        const storedToken = localStorage.getItem('token');
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          console.error('Error getting session:', error);
        }

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        const accessToken = currentSession?.access_token ?? storedToken ?? null;
        setToken(accessToken);

        if (currentSession?.access_token) {
          localStorage.setItem('token', currentSession.access_token);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    hydrate();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Fetch profile/role whenever the authenticated user changes.
  useEffect(() => {
    let cancelled = false;

    const loadUserData = async () => {
      if (!user) {
        setProfile(null);
        setRole(null);
        setUserDataLoading(false);
        return;
      }

      setUserDataLoading(true);
      try {
        await fetchUserData(user.id);
      } finally {
        if (!cancelled) {
          setUserDataLoading(false);
        }
      }
    };

    loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchUserData]);

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
      // Use the backend function for signup to bypass RLS issues
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // Mirror token immediately on successful login.
      const accessToken = data?.session?.access_token ?? null;
      if (accessToken) {
        localStorage.setItem('token', accessToken);
        setToken(accessToken);
      }

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      token,
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

