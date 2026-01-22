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
      const { data, error: fnError } = await supabase.functions.invoke('fetch-fund-account', {
        body: { user_id: userId },
      });

      if (fnError) {
        console.error('Error fetching external balance:', fnError);
        setError(fnError.message);
        return;
      }

      if (data?.success) {
        setBalance(data.balance);
        setFrozen(data.frozen ?? 0);
      } else {
        setError(data?.error || 'Failed to fetch balance');
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

  return {
    balance,
    frozen,
    isLoading,
    error,
    refetch: fetchBalance,
  };
}
