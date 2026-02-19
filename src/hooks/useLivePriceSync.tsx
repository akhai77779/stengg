import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LivePriceSyncOptions {
  /** Enable or disable auto-sync (default: true) */
  enabled?: boolean;
  /** Polling interval in ms (default: 5000) */
  interval?: number;
  /** Optional list of product IDs to sync. If empty, syncs all available products */
  productIds?: string[];
  onSuccess?: (synced: number) => void;
  onError?: (err: Error) => void;
}

interface LivePriceSyncResult {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  successCount: number;
  failCount: number;
  /** Manually trigger a sync */
  triggerSync: () => void;
}

/**
 * Polls `sync-live-price` edge function on a set interval to keep
 * product prices and the currently-running candle up to date.
 *
 * This ONLY updates:
 *   - products.price  (latest close price)
 *   - price_history   (the current open 1-minute candle via upsert)
 *
 * Heavy historical sync is handled separately by `sync-price-history`.
 */
export function useLivePriceSync(options: LivePriceSyncOptions = {}): LivePriceSyncResult {
  const {
    enabled = true,
    interval = 5000,
    productIds,
    onSuccess,
    onError,
  } = options;

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);

  const isSyncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doSync = useCallback(async () => {
    if (isSyncingRef.current) return; // Prevent overlapping calls
    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      const body: Record<string, unknown> = {};
      if (productIds && productIds.length > 0) {
        body.productIds = productIds;
      }

      const { data, error } = await supabase.functions.invoke('sync-live-price', { body });

      if (error) {
        onError?.(new Error(error.message));
        return;
      }

      const synced: number = data?.synced ?? 0;
      const failed: number = data?.failed ?? 0;
      setSuccessCount(synced);
      setFailCount(failed);
      setLastSyncAt(new Date());
      onSuccess?.(synced);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Unknown sync error'));
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [productIds, onSuccess, onError]);

  // Start / stop polling when `enabled` or `interval` changes
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Immediate first call
    doSync();

    intervalRef.current = setInterval(doSync, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, doSync]);

  return { isSyncing, lastSyncAt, successCount, failCount, triggerSync: doSync };
}
