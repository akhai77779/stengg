import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExternalBalanceData {
  balance: number | null;
  frozen: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Global cache for balance data
const balanceCache = new Map<string, { balance: number; frozen: number; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds cache TTL for balance (shorter than profile)

export function useExternalBalance(userId: string | undefined): ExternalBalanceData {
  const [balance, setBalance] = useState<number | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Prevent duplicate fetches
  const fetchInProgressRef = useRef<boolean>(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setBalance(null);
      setFrozen(null);
      setIsLoading(false);
      return;
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = balanceCache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('Balance loaded from cache for:', userId);
        setBalance(cached.balance);
        setFrozen(cached.frozen);
        setIsLoading(false);
        return;
      }
    }

    // Skip if already fetching for this user
    if (fetchInProgressRef.current && lastFetchedUserIdRef.current === userId) {
      console.log('Balance fetch skipped - already in progress for:', userId);
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchedUserIdRef.current = userId;
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching balance for:', userId);
      
      // Use profiles_safe view to exclude sensitive fields
      const { data: profile, error: dbError } = await supabase
        .from('profiles_safe')
        .select('balance')
        .eq('id', userId)
        .maybeSingle();

      if (dbError) {
        console.error('Error fetching balance from profiles_safe:', dbError);
        setError(dbError.message);
        return;
      }

      const balanceValue = profile?.balance ?? 0;
      const frozenValue = 0; // profiles table doesn't have frozen balance
      
      setBalance(balanceValue);
      setFrozen(frozenValue);
      
      // Update cache
      balanceCache.set(userId, {
        balance: balanceValue,
        frozen: frozenValue,
        timestamp: Date.now()
      });
      console.log('Balance cached for:', userId);
    } catch (err) {
      console.error('Error in useExternalBalance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Realtime subscription for balance updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`balance-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Balance updated via realtime:', payload);
          const newBalance = payload.new as { balance: number | null };
          const balanceValue = newBalance.balance ?? 0;
          setBalance(balanceValue);
          
          // Update cache with new data
          balanceCache.set(userId, {
            balance: balanceValue,
            frozen: 0,
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
    await fetchBalance(true); // Force refresh bypasses cache
  }, [fetchBalance]);

  return {
    balance,
    frozen,
    isLoading,
    error,
    refetch,
  };
}

// Utility function to invalidate balance cache
export function invalidateBalanceCache(userId: string): void {
  balanceCache.delete(userId);
  console.log('Balance cache invalidated for:', userId);
}

// Utility function to clear all cached balances
export function clearBalanceCache(): void {
  balanceCache.clear();
  console.log('All balance cache cleared');
}
