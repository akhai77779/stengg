import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { OHLCData } from '@/components/charts/CandlestickChart';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface PriceHistoryPayload {
  product_id: string;
  recorded_at: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume?: number;
}

interface ProductPayload {
  id: string;
  name: string;
  symbol?: string;
  price?: number;
  high_24h?: number;
  low_24h?: number;
  price_change?: number;
  volume?: string;
  turnover?: string;
}

interface UseProductRealtimeOptions {
  productId: string;
  enabled?: boolean;
  onCandleUpdate: (candle: OHLCData) => void;
  onProductUpdate: (product: ProductPayload) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  throttleMs?: number;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface RealtimeStats {
  updateCount: number;
  lastUpdateTime: number | null;
  connectionUptime: number;
  reconnectCount: number;
}

// Global channel registry to prevent duplicate subscriptions
const activeChannels = new Map<string, { channel: RealtimeChannel; refCount: number }>();

/**
 * Optimized hook for product realtime subscriptions
 * Features:
 * - Single consolidated channel for all product data
 * - Global channel registry to prevent duplicates
 * - Throttled updates to prevent UI overload
 * - Auto-reconnect with exponential backoff
 * - Comprehensive status tracking and logging
 */
export function useProductRealtime({
  productId,
  enabled = true,
  onCandleUpdate,
  onProductUpdate,
  onStatusChange,
  throttleMs = 100,
  reconnectDelay = 2000,
  maxReconnectAttempts = 5,
}: UseProductRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const pendingCandleRef = useRef<OHLCData | null>(null);
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [stats, setStats] = useState<RealtimeStats>({
    updateCount: 0,
    lastUpdateTime: null,
    connectionUptime: 0,
    reconnectCount: 0,
  });

  // Throttled candle update handler
  const processCandle = useCallback((candle: OHLCData) => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= throttleMs) {
      // Enough time passed, update immediately
      lastUpdateRef.current = now;
      onCandleUpdate(candle);
      setStats(prev => ({
        ...prev,
        updateCount: prev.updateCount + 1,
        lastUpdateTime: now,
      }));
    } else {
      // Store pending update and schedule
      pendingCandleRef.current = candle;
      
      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(() => {
          if (pendingCandleRef.current) {
            lastUpdateRef.current = Date.now();
            onCandleUpdate(pendingCandleRef.current);
            setStats(prev => ({
              ...prev,
              updateCount: prev.updateCount + 1,
              lastUpdateTime: Date.now(),
            }));
            pendingCandleRef.current = null;
          }
          throttleTimeoutRef.current = null;
        }, throttleMs - elapsed);
      }
    }
  }, [onCandleUpdate, throttleMs]);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
    
    if (newStatus === 'connected') {
      connectedAtRef.current = Date.now();
    }
  }, [onStatusChange]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    if (channelRef.current && productId) {
      const channelName = `product_${productId}`;
      const entry = activeChannels.get(channelName);
      
      if (entry) {
        entry.refCount--;
        console.log(`[Realtime] Decreasing refCount for ${channelName}: ${entry.refCount}`);
        
        if (entry.refCount <= 0) {
          console.log(`[Realtime] Removing channel: ${channelName}`);
          supabase.removeChannel(entry.channel);
          activeChannels.delete(channelName);
        }
      }
      channelRef.current = null;
    }
  }, [productId]);

  const subscribe = useCallback(() => {
    if (!enabled || !productId) return;

    // Check if channel already exists in global registry
    const channelName = `product_${productId}`;
    const existingEntry = activeChannels.get(channelName);
    
    if (existingEntry) {
      console.log(`[Realtime] Reusing existing channel: ${channelName}`);
      existingEntry.refCount++;
      channelRef.current = existingEntry.channel;
      updateStatus('connected');
      return;
    }

    updateStatus('connecting');
    console.log(`[Realtime] Creating new channel: ${channelName}`);

    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      // Subscribe to price_history changes (candles)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_history',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          const record = payload.new as PriceHistoryPayload;
          
          const candle: OHLCData = {
            time: record.recorded_at,
            open: record.open_price,
            high: record.high_price,
            low: record.low_price,
            close: record.close_price,
          };

          console.log(`[Realtime] Candle ${payload.eventType}:`, candle.time);
          processCandle(candle);
        }
      )
      // Subscribe to product price updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`,
        },
        (payload) => {
          console.log(`[Realtime] Product update:`, payload.new);
          onProductUpdate(payload.new as ProductPayload);
        }
      )
      .subscribe((subscriptionStatus, err) => {
        console.log(`[Realtime ${channelName}] Status:`, subscriptionStatus, err?.message);

        if (subscriptionStatus === 'SUBSCRIBED') {
          updateStatus('connected');
          reconnectAttempts.current = 0;
          console.log(`[Realtime] Successfully connected to ${channelName}`);
        } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
          updateStatus('disconnected');

          // Auto-reconnect with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current);
            console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            
            updateStatus('reconnecting');
            setStats(prev => ({
              ...prev,
              reconnectCount: prev.reconnectCount + 1,
            }));
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              subscribe();
            }, delay);
          } else {
            console.error(`[Realtime] Max reconnect attempts reached for ${channelName}`);
          }
        }
      });

    // Register in global channel registry
    activeChannels.set(channelName, { channel, refCount: 1 });
    channelRef.current = channel;
  }, [productId, enabled, processCandle, onProductUpdate, updateStatus, reconnectDelay, maxReconnectAttempts]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log('[Realtime] Manual reconnect triggered');
    cleanup(); // Clean up existing channel first
    reconnectAttempts.current = 0;
    subscribe();
  }, [subscribe, cleanup]);

  // Get connection uptime
  const getUptime = useCallback(() => {
    if (!connectedAtRef.current || status !== 'connected') return 0;
    return Date.now() - connectedAtRef.current;
  }, [status]);

  // Subscribe on mount, cleanup on unmount
  useEffect(() => {
    subscribe();
    return cleanup;
  }, [subscribe, cleanup]);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    status,
    stats,
    reconnect,
    getUptime,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
  }), [status, stats, reconnect, getUptime]);
}

/**
 * Hook for user-specific realtime subscriptions (e.g., option trades)
 */
interface UseUserRealtimeOptions {
  userId: string;
  productId?: string;
  enabled?: boolean;
  onTradeUpdate: () => void;
  debounceMs?: number;
}

export function useUserTradesRealtime({
  userId,
  productId,
  enabled = true,
  onTradeUpdate,
  debounceMs = 300,
}: UseUserRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onTradeUpdate();
      debounceRef.current = null;
    }, debounceMs);
  }, [onTradeUpdate, debounceMs]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const channelName = productId 
      ? `user_trades_${userId}_${productId}`
      : `user_trades_${userId}`;

    console.log(`[Realtime] Subscribing to user trades: ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'option_trades',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log(`[Realtime] Trade ${payload.eventType}`);
          debouncedUpdate();
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
          setStatus('disconnected');
        }
      });

    channelRef.current = channel;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, productId, enabled, debouncedUpdate]);

  return { status, isConnected: status === 'connected' };
}
