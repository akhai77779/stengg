import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExternalBalanceData {
  balance: number | null;
  frozen: number | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExternalBalance(userId: string | undefined): ExternalBalanceData {
  const [balance, setBalance] = useState<number | null>(null);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!userId) {
      setBalance(null);
      setFrozen(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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

      if (profile) {
        setBalance(profile.balance ?? 0);
        setFrozen(0); // profiles table doesn't have frozen balance
      } else {
        setBalance(0);
        setFrozen(0);
      }
    } catch (err) {
      console.error('Error in useExternalBalance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
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
          setBalance(newBalance.balance ?? 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    balance,
    frozen,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
