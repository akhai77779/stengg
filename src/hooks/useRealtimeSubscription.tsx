import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

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

export type RealtimePayload = PriceHistoryPayload | ProductPayload | Record<string, unknown>;

interface UseRealtimePriceHistoryOptions {
  productId: string;
  enabled?: boolean;
  onData: (eventType: string, record: PriceHistoryPayload) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export function useRealtimePriceHistory({
  productId,
  enabled = true,
  onData,
  onStatusChange,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: UseRealtimePriceHistoryOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [updateCount, setUpdateCount] = useState(0);

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    if (!enabled || !productId) return;

    cleanup();
    updateStatus('connecting');

    const channelName = `price_history_${productId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_history',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          console.log(`[Realtime ${channelName}]`, payload.eventType, payload.new);
          setUpdateCount(prev => prev + 1);
          onData(payload.eventType, payload.new as PriceHistoryPayload);
        }
      )
      .subscribe((subscriptionStatus, err) => {
        console.log(`[Realtime ${channelName}] Status:`, subscriptionStatus, err?.message);

        if (subscriptionStatus === 'SUBSCRIBED') {
          updateStatus('connected');
          reconnectAttempts.current = 0;
        } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
          updateStatus('disconnected');

          // Auto-reconnect with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current);
            console.log(`[Realtime ${channelName}] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            
            updateStatus('reconnecting');
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              subscribe();
            }, delay);
          } else {
            console.error(`[Realtime ${channelName}] Max reconnect attempts reached`);
          }
        }
      });

    channelRef.current = channel;
  }, [productId, enabled, onData, updateStatus, cleanup, reconnectDelay, maxReconnectAttempts]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    subscribe();
  }, [subscribe]);

  useEffect(() => {
    subscribe();
    return cleanup;
  }, [subscribe, cleanup]);

  return {
    status,
    updateCount,
    reconnect,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
  };
}

// Hook for product updates
interface UseRealtimeProductOptions {
  productId: string;
  enabled?: boolean;
  onData: (eventType: string, record: ProductPayload) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

export function useRealtimeProduct({
  productId,
  enabled = true,
  onData,
  onStatusChange,
}: UseRealtimeProductOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !productId) return;

    const channelName = `product_price_${productId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`,
        },
        (payload) => {
          console.log(`[Realtime ${channelName}]`, payload.eventType, payload.new);
          onData(payload.eventType, payload.new as ProductPayload);
        }
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('connected');
          onStatusChange?.('connected');
        } else if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') {
          setStatus('disconnected');
          onStatusChange?.('disconnected');
        }
      });

    channelRef.current = channel;

    return cleanup;
  }, [productId, enabled, onData, onStatusChange, cleanup]);

  return { status, isConnected: status === 'connected' };
}
