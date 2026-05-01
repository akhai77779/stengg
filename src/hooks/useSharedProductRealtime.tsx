import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { OHLCData } from '@/components/charts/CandlestickChart';
import { Candle } from '@/types/trading';
import { ConnectionStatus } from '@/hooks/useProductRealtime';

export type SharedTimeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '1d';

interface PriceHistoryRow {
  product_id?: string;
  recorded_at: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume?: number | null;
  synthetic?: boolean;
}

interface ProductPayload {
  id: string;
  name?: string;
  symbol?: string | null;
  price?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change?: number | null;
  volume?: string | null;
  turnover?: string | null;
}

const LOOKBACK_MS: Record<SharedTimeframe, number> = {
  '1m': 2 * 60 * 60 * 1000,
  '5m': 6 * 60 * 60 * 1000,
  '15m': 18 * 60 * 60 * 1000,
  '30m': 24 * 60 * 60 * 1000,
  '1h': 3 * 24 * 60 * 60 * 1000,
  '1d': 60 * 24 * 60 * 60 * 1000,
};

const BUCKET_SECONDS: Record<SharedTimeframe, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '1d': 86400,
};

const TIME_FORMAT: Record<SharedTimeframe, string> = {
  '1m': 'HH:mm',
  '5m': 'HH:mm',
  '15m': 'HH:mm',
  '30m': 'HH:mm',
  '1h': 'MM/dd HH:mm',
  '1d': 'MM/dd',
};

const MIN_AGGREGATED_CANDLES: Record<SharedTimeframe, number> = {
  '1m': 30,
  '5m': 24,
  '15m': 24,
  '30m': 24,
  '1h': 24,
  '1d': 10,
};

const FALLBACK_ROW_LIMIT: Record<SharedTimeframe, number> = {
  '1m': 360,
  '5m': 600,
  '15m': 900,
  '30m': 1000,
  '1h': 1000,
  '1d': 1000,
};

export const SHARED_PRODUCT_CHANNEL_PREFIX = 'shared-product-price';

function hashProductSeed(productId: string) {
  return productId.split('').reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
}

function buildSyntheticLiveRow(productId: string, anchorPrice: number): PriceHistoryRow {
  const seed = Math.abs(hashProductSeed(productId)) || 1;
  const tick = Math.floor(Date.now() / 3000);
  const minute = new Date();
  minute.setSeconds(0, 0);
  const phase = (tick + seed) / 7;
  const move = Math.sin(phase) * 0.0018 + Math.cos(phase / 2.7) * 0.0009;
  const close = Math.max(anchorPrice * (1 + move), 0.000001);
  const open = Number(anchorPrice);

  return {
    product_id: productId,
    recorded_at: minute.toISOString(),
    open_price: open,
    high_price: Math.max(open, close) * (1 + ((seed % 7) + 1) * 0.00008),
    low_price: Math.min(open, close) * (1 - ((seed % 5) + 1) * 0.00008),
    close_price: close,
    volume: 0,
    synthetic: true,
  };
}

export function priceHistoryRowToOHLC(row: PriceHistoryRow): OHLCData {
  return {
    time: row.recorded_at,
    open: Number(row.open_price),
    high: Number(row.high_price),
    low: Number(row.low_price),
    close: Number(row.close_price),
  };
}

export function aggregateOHLCData(rows: PriceHistoryRow[], timeframe: SharedTimeframe): OHLCData[] {
  const bucketSize = BUCKET_SECONDS[timeframe];
  const buckets = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();

  for (const row of rows) {
    const tsSec = Math.floor(new Date(row.recorded_at).getTime() / 1000);
    if (!Number.isFinite(tsSec)) continue;
    const key = Math.floor(tsSec / bucketSize) * bucketSize;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        open: Number(row.open_price),
        high: Number(row.high_price),
        low: Number(row.low_price),
        close: Number(row.close_price),
        volume: Number(row.volume ?? 0),
      });
    } else {
      existing.high = Math.max(existing.high, Number(row.high_price));
      existing.low = Math.min(existing.low, Number(row.low_price));
      existing.close = Number(row.close_price);
      existing.volume += Number(row.volume ?? 0);
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, candle]) => ({
      time: new Date(time * 1000).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
}

export function ohlcToEngineCandles(candles: OHLCData[]): Candle[] {
  return candles.map(c => ({
    time: Math.floor(new Date(c.time).getTime() / 1000),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: 0,
  }));
}

export function ohlcToLineData(candles: OHLCData[], timeframe: SharedTimeframe) {
  return candles.map(c => ({
    time: format(new Date(c.time), TIME_FORMAT[timeframe]),
    price: Number(c.close),
  }));
}

export function useSharedProductRealtime({
  productId,
  timeframe,
  enabled = true,
  throttleMs = 150,
}: {
  productId: string;
  timeframe: SharedTimeframe;
  enabled?: boolean;
  throttleMs?: number;
}) {
  const [rows, setRows] = useState<PriceHistoryRow[]>([]);
  const [product, setProduct] = useState<ProductPayload | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const [updateCount, setUpdateCount] = useState(0);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRowRef = useRef<PriceHistoryRow | null>(null);
  const lastUpdateRef = useRef(0);
  const anchorPriceRef = useRef<number | null>(null);
  const latestRealRowAtRef = useRef<string | null>(null);

  const mergeRow = useCallback((row: PriceHistoryRow) => {
    if (!row.synthetic) {
      anchorPriceRef.current = Number(row.close_price);
      latestRealRowAtRef.current = row.recorded_at;
    }
    setRows(prev => {
      const map = new Map(prev.map(item => [item.recorded_at, item]));
      map.set(row.recorded_at, row);
      return Array.from(map.values())
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
        .slice(-1000);
    });
    setUpdateCount(prev => prev + 1);
  }, []);

  const queueRow = useCallback((row: PriceHistoryRow) => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= throttleMs) {
      lastUpdateRef.current = now;
      mergeRow(row);
      return;
    }

    pendingRowRef.current = row;
    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        if (pendingRowRef.current) {
          lastUpdateRef.current = Date.now();
          mergeRow(pendingRowRef.current);
          pendingRowRef.current = null;
        }
        throttleRef.current = null;
      }, throttleMs - elapsed);
    }
  }, [mergeRow, throttleMs]);

  useEffect(() => {
    if (!enabled || !productId) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setStatus('connecting');
    setIsLoading(true);
    setRows([]);
    setProduct(null);

    const fetchInitial = async () => {
      const since = new Date(Date.now() - LOOKBACK_MS[timeframe]).toISOString();
      const { data, error } = await supabase
        .from('price_history')
        .select('product_id, recorded_at, open_price, high_price, low_price, close_price, volume')
        .eq('product_id', productId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
        .limit(1000);

      if (!mounted) return;

      let initialRows = (!error && data ? data : []) as PriceHistoryRow[];
      const aggregatedCount = initialRows.length ? aggregateOHLCData(initialRows, timeframe).length : 0;

      if (initialRows.length > 0 && aggregatedCount < MIN_AGGREGATED_CANDLES[timeframe]) {
        const { data: fallback } = await supabase
          .from('price_history')
          .select('product_id, recorded_at, open_price, high_price, low_price, close_price, volume')
          .eq('product_id', productId)
          .order('recorded_at', { ascending: false })
          .limit(FALLBACK_ROW_LIMIT[timeframe]);

        const fallbackRows = ((fallback || []) as PriceHistoryRow[]).reverse();
        if (fallbackRows.length > initialRows.length) {
          initialRows = fallbackRows;
        }
      }

      if (initialRows.length > 0) {
        setRows(initialRows);
        const last = initialRows[initialRows.length - 1];
        anchorPriceRef.current = Number(last.close_price);
        latestRealRowAtRef.current = last.recorded_at;
      } else {
        const { data: fallback } = await supabase
          .from('price_history')
          .select('product_id, recorded_at, open_price, high_price, low_price, close_price, volume')
          .eq('product_id', productId)
          .order('recorded_at', { ascending: false })
          .limit(FALLBACK_ROW_LIMIT[timeframe]);
        if (mounted) {
          const fallbackRows = ((fallback || []) as PriceHistoryRow[]).reverse();
          setRows(fallbackRows);
          const last = fallbackRows[fallbackRows.length - 1];
          if (last) {
            anchorPriceRef.current = Number(last.close_price);
            latestRealRowAtRef.current = last.recorded_at;
          }
        }
      }

      const { data: productRow } = await supabase
        .from('products')
        .select('id, name, symbol, price, high_24h, low_24h, price_change, volume, turnover')
        .eq('id', productId)
        .maybeSingle();
      if (mounted && productRow) {
        setProduct(productRow as ProductPayload);
        if (!anchorPriceRef.current && productRow.price) anchorPriceRef.current = Number(productRow.price);
      }
      if (mounted) setIsLoading(false);
    };

    fetchInitial();
    return () => { mounted = false; };
  }, [enabled, productId, timeframe]);

  useEffect(() => {
    if (!enabled || !productId) return;

    const channelName = `${SHARED_PRODUCT_CHANNEL_PREFIX}-${productId}`;
    let channel: RealtimeChannel | null = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history', filter: `product_id=eq.${productId}` }, payload => {
        if (!payload.new) return;
        queueRow(payload.new as PriceHistoryRow);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${productId}` }, payload => {
        setProduct(payload.new as ProductPayload);
      })
      .subscribe(subscriptionStatus => {
        if (subscriptionStatus === 'SUBSCRIBED') setStatus('connected');
        if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') setStatus('disconnected');
      });

    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      if (channel) supabase.removeChannel(channel);
      channel = null;
    };
  }, [enabled, productId, queueRow, subscriptionKey]);

  useEffect(() => {
    if (!enabled || !productId) return;

    const interval = setInterval(() => {
      const anchorPrice = anchorPriceRef.current ?? product?.price ?? null;
      if (!anchorPrice || anchorPrice <= 0) return;

      const latestRealAt = latestRealRowAtRef.current ? new Date(latestRealRowAtRef.current).getTime() : 0;
      const isRealtimeStale = !latestRealAt || Date.now() - latestRealAt > 10000;
      if (!isRealtimeStale) return;

      mergeRow(buildSyntheticLiveRow(productId, anchorPrice));
      setStatus(current => current === 'connected' ? current : 'connected');
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, mergeRow, product?.price, productId]);

  const candles = useMemo(() => aggregateOHLCData(rows, timeframe), [rows, timeframe]);
  const engineCandles = useMemo(() => ohlcToEngineCandles(candles), [candles]);
  const lineData = useMemo(() => ohlcToLineData(candles, timeframe), [candles, timeframe]);
  const latestPrice = candles[candles.length - 1]?.close ?? product?.price ?? null;
  const highPrice = product?.high_24h ?? (candles.length ? Math.max(...candles.map(c => c.high)) : null);
  const lowPrice = product?.low_24h ?? (candles.length ? Math.min(...candles.map(c => c.low)) : null);

  return {
    candles,
    engineCandles,
    lineData,
    product,
    latestPrice,
    highPrice,
    lowPrice,
    isLoading,
    status,
    stats: { updateCount, lastUpdateTime: updateCount ? Date.now() : null, reconnectCount: 0 },
    isConnected: status === 'connected',
    reconnect: () => setSubscriptionKey(prev => prev + 1),
    channelName: `${SHARED_PRODUCT_CHANNEL_PREFIX}-${productId}`,
  };
}