import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  balance: number | null;
  total_income: number | null;
  user_code: number | null;
  email: string | null;
  phone: string | null;
  is_frozen: boolean | null;
  is_trade_frozen: boolean | null;
  frozen_reason: string | null;
}

interface UseProfileResult {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Global cache for profile data to prevent duplicate fetches across components
const profileCache = new Map<string, { data: Profile; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

export function useProfile(userId: string | undefined): UseProfileResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate fetches
  const fetchInProgressRef = useRef<boolean>(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = profileCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('Profile loaded from cache for:', userId);
        setProfile(cached.data);
        setIsLoading(false);
        return;
      }
    }

    // Skip if already fetching for this user
    if (fetchInProgressRef.current && lastFetchedUserIdRef.current === userId) {
      console.log('Profile fetch skipped - already in progress for:', userId);
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchedUserIdRef.current = userId;
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching profile for:', userId);
      
      // Use profiles_safe view to exclude sensitive fields
      const { data, error: fetchError } = await supabase
        .from('profiles_safe')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching profile:', fetchError);
        setError(fetchError.message);
        setProfile(null);
      } else if (data) {
        const profileData = data as Profile;
        setProfile(profileData);
        
        // Update cache
        profileCache.set(userId, {
          data: profileData,
          timestamp: Date.now()
        });
        console.log('Profile cached for:', userId);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error in useProfile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProfile(null);
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Realtime subscription for profile updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`profile-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Profile updated via realtime:', payload.new);
          const newData = payload.new as Profile;
          setProfile(newData);
          
          // Update cache with new data
          profileCache.set(userId, {
            data: newData,
            timestamp: Date.now()
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const refetch = useCallback(async () => {
    await fetchProfile(true); // Force refresh bypasses cache
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch
  };
}

// Utility function to invalidate cache for a user
export function invalidateProfileCache(userId: string): void {
  profileCache.delete(userId);
  console.log('Profile cache invalidated for:', userId);
}

// Utility function to clear all cached profiles
export function clearProfileCache(): void {
  profileCache.clear();
  console.log('All profile cache cleared');
}
