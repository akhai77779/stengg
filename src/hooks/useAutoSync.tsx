import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SyncResult {
  banners: { synced: number; errors: number; skipped: number };
  products: { synced: number; errors: number; skipped: number };
  news: { synced: number; errors: number; skipped: number };
}

interface UseAutoSyncOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  onSuccess?: (result: SyncResult) => void;
  onError?: (error: Error) => void;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
  const { 
    enabled = false, // Disabled
    interval = 1000, // 1 second for faster updates
    onSuccess,
    onError 
  } = options;
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    // Prevent overlapping syncs
    if (isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    
    try {
      const { data, error } = await supabase.functions.invoke('sync-external-data', {
        body: { silent: true }
      });

      if (error) {
        console.error('Auto-sync error:', error);
        onError?.(new Error(error.message));
      } else if (data) {
        onSuccess?.(data as SyncResult);
      }
    } catch (err) {
      console.error('Auto-sync exception:', err);
      onError?.(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      isSyncingRef.current = false;
    }
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial sync
    sync();

    // Set up interval
    intervalRef.current = setInterval(sync, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, sync]);

  return { sync };
}
