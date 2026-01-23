import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; frozenReason?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role check with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    setIsAdminLoading(true);
    try {
      console.log('Checking admin role for user:', userId);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      console.log('Admin role check result:', { data, error, userId });

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        return;
      }

      console.log('Setting isAdmin to:', !!data);
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    } finally {
      setIsAdminLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    return { error };
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; frozenReason?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { error };
    }
    
    // Check if account is frozen
    if (data?.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_frozen, frozen_reason')
        .eq('id', data.user.id)
        .single();
      
      if (!profileError && profile?.is_frozen) {
        // Account is frozen - sign out immediately
        await supabase.auth.signOut();
        return { 
          error: new Error(profile.frozen_reason || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.'),
          frozenReason: profile.frozen_reason || 'Tài khoản đã bị khóa'
        };
      }
    }
    
    // Track login IP after successful sign in
    if (data?.session) {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session.access_token}`,
          },
        });
      } catch (e) {
        console.error('Failed to track login:', e);
      }
    }
    
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isAdmin, isAdminLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
