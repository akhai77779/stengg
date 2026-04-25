import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { clearProfileCache } from '@/hooks/useProfile';
import { clearBalanceCache } from '@/hooks/useExternalBalance';

/**
 * Authentication Context and Provider
 * 
 * SECURITY NOTICE:
 * ================
 * The `isAdmin` state is for UI DISPLAY PURPOSES ONLY.
 * It determines which UI elements to show/hide (admin menus, buttons, etc.)
 * 
 * ⚠️ IMPORTANT: Do NOT rely on `isAdmin` for authorization decisions!
 * 
 * All actual access control is enforced server-side via:
 * 1. Row-Level Security (RLS) policies using `has_role(auth.uid(), 'admin')`
 * 2. SECURITY DEFINER functions that verify admin role before operations
 * 
 * Even if a malicious user manipulates the client-side `isAdmin` state,
 * database queries will still fail due to RLS policies. This provides
 * defense-in-depth security.
 * 
 * For critical admin operations, always use:
 * - RLS policies with `USING (has_role(auth.uid(), 'admin'))`
 * - Server-side role verification in Edge Functions
 */

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** 
   * UI-only admin flag. Use for showing/hiding admin UI elements.
   * @security Do NOT use for authorization - server RLS policies enforce actual access.
   */
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
  // SECURITY: isAdmin is UI-only. Actual authorization is enforced by server-side RLS policies.
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  
  // Optimization: Track last checked user ID to prevent duplicate calls
  const lastCheckedUserIdRef = useRef<string | null>(null);
  const checkInProgressRef = useRef<boolean>(false);

  const checkAdminRole = useCallback(async (userId: string) => {
    // Skip if already checked for this user or check is in progress
    if (lastCheckedUserIdRef.current === userId || checkInProgressRef.current) {
      console.log('Admin role check skipped - already checked or in progress for:', userId);
      return;
    }
    
    checkInProgressRef.current = true;
    setIsAdminLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin',
      });

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(data === true);
      // Mark this user as checked
      lastCheckedUserIdRef.current = userId;
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    } finally {
      setIsAdminLoading(false);
      checkInProgressRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Reset cache when user changes (sign out or sign in with different user)
        if (event === 'SIGNED_OUT') {
          lastCheckedUserIdRef.current = null;
          setIsAdmin(false);
          setIsAdminLoading(false);
        } else if (session?.user) {
          // Defer role check with setTimeout to prevent deadlock
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdminLoading(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [checkAdminRole]);

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
    
    // Check if account is frozen - using profiles_safe view for security
    if (data?.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles_safe')
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
    // Clear all cached data before signing out
    clearProfileCache();
    clearBalanceCache();
    console.log('All user caches cleared on logout');
    
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
