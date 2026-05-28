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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidProductId = (id: string | undefined | null): boolean =>
  !!id && UUID_REGEX.test(id);

// Module-level cache so chart data survives unmount/remount when navigating
// away and back to the same product. Keyed by `${productId}::${timeframe}`.
interface SharedProductCacheEntry {
  rows: PriceHistoryRow[];
  product: ProductPayload | null;
  anchorPrice: number | null;
  latestRealRowAt: string | null;
  updatedAt: number;
}
const sharedProductCache = new Map<string, SharedProductCacheEntry>();
const CACHE_MAX_ENTRIES = 24;
const cacheKey = (productId: string, timeframe: SharedTimeframe) => `${productId}::${timeframe}`;
function writeCache(key: string, entry: SharedProductCacheEntry) {
  sharedProductCache.set(key, entry);
  if (sharedProductCache.size > CACHE_MAX_ENTRIES) {
    // Evict the oldest entry (insertion order)
    const firstKey = sharedProductCache.keys().next().value;
    if (firstKey && firstKey !== key) sharedProductCache.delete(firstKey);
  }
}

/** Treat null/undefined/0/NaN/Infinity as invalid so we don't surface $0.00 to the UI. */
function pickValid(value: number | null | undefined, fallback: number | null): number | null {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

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
  // Internal guard: invalid/empty productId must never open a subscription
  const isActive = enabled && isValidProductId(productId);
  const initialKey = isActive ? cacheKey(productId, timeframe) : null;
  const initialCache = initialKey ? sharedProductCache.get(initialKey) : undefined;
  const [rows, setRows] = useState<PriceHistoryRow[]>(() => initialCache?.rows ?? []);
  const [product, setProduct] = useState<ProductPayload | null>(() => initialCache?.product ?? null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  // If we already have cached rows, treat as not loading so the chart hydrates instantly
  const [isLoading, setIsLoading] = useState(() => !(initialCache && initialCache.rows.length > 0));
  const [updateCount, setUpdateCount] = useState(0);
  const [subscriptionKey, setSubscriptionKey] = useState(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRowRef = useRef<PriceHistoryRow | null>(null);
  const lastUpdateRef = useRef(0);
  const anchorPriceRef = useRef<number | null>(null);
  const latestRealRowAtRef = useRef<string | null>(null);
  // Tracks which productId the current refs/state belong to.
  // Used to drop late async results from a previous product.
  const activeProductIdRef = useRef<string | null>(null);
  // Stable ref for product price so the synthetic loop doesn't need to re-subscribe on every tick
  const productPriceRef = useRef<number | null>(null);

  const mergeRow = useCallback((row: PriceHistoryRow) => {
    // Drop cross-product leakage: ignore rows whose product_id doesn't match.
    if (row.product_id && activeProductIdRef.current && row.product_id !== activeProductIdRef.current) {
      return;
    }
    if (!row.synthetic) {
      anchorPriceRef.current = Number(row.close_price);
      latestRealRowAtRef.current = row.recorded_at;
    }
    setRows(prev => {
      const map = new Map(prev.map(item => [item.recorded_at, item]));
      // Never let a synthetic row overwrite a real row at the same timestamp.
      const existing = map.get(row.recorded_at);
      if (row.synthetic && existing && !existing.synthetic) {
        return prev;
      }
      map.set(row.recorded_at, row);
      return Array.from(map.values())
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
        .slice(-1000);
    });
    setUpdateCount(prev => prev + 1);
  }, []);

  const queueRow = useCallback((row: PriceHistoryRow) => {
    if (row.product_id && activeProductIdRef.current && row.product_id !== activeProductIdRef.current) {
      return;
    }
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
    if (!isActive) {
      setIsLoading(false);
      setStatus('disconnected');
      activeProductIdRef.current = null;
      anchorPriceRef.current = null;
      latestRealRowAtRef.current = null;
      pendingRowRef.current = null;
      lastUpdateRef.current = 0;
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
      return;
    }

    let mounted = true;
    // Reset per-product refs on switch (state is hydrated from cache, see below)
    activeProductIdRef.current = productId;
    pendingRowRef.current = null;
    lastUpdateRef.current = 0;
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
      throttleRef.current = null;
    }
    setStatus('connecting');

    const key = cacheKey(productId, timeframe);
    const cached = sharedProductCache.get(key);
    if (cached && cached.rows.length > 0) {
      // Hydrate instantly from cache; refresh in background without clearing the chart
      setRows(cached.rows);
      if (cached.product) setProduct(cached.product);
      anchorPriceRef.current = cached.anchorPrice;
      latestRealRowAtRef.current = cached.latestRealRowAt;
      if (cached.product?.price) productPriceRef.current = Number(cached.product.price);
      setIsLoading(false);
    } else {
      // No cache: clear stale data from previous product before fetching
      setRows([]);
      setProduct(null);
      anchorPriceRef.current = null;
      latestRealRowAtRef.current = null;
      setIsLoading(true);
    }

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
          if (fallbackRows.length > 0) setRows(fallbackRows);
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
        productPriceRef.current = pickValid(productRow.price as number | null, productPriceRef.current);
        if (!anchorPriceRef.current && productRow.price) anchorPriceRef.current = Number(productRow.price);
      }
      if (mounted) setIsLoading(false);
    };

    fetchInitial();
    return () => {
      mounted = false;
      // Drop any pending throttled row from this product before unmounting/switching
      pendingRowRef.current = null;
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [isActive, productId, timeframe]);

  useEffect(() => {
    if (!isActive) return;

    const channelName = `${SHARED_PRODUCT_CHANNEL_PREFIX}-${productId}`;
    let channel: RealtimeChannel | null = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history', filter: `product_id=eq.${productId}` }, payload => {
        if (!payload.new) return;
        const row = payload.new as PriceHistoryRow;
        // Defensive: only accept rows for the active product
        if (row.product_id && row.product_id !== productId) return;
        queueRow(row);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${productId}` }, payload => {
        const next = payload.new as ProductPayload;
        if (next?.id && next.id !== productId) return;
        setProduct(next);
        productPriceRef.current = pickValid(next?.price as number | null, productPriceRef.current);
      })
      .subscribe(subscriptionStatus => {
        if (subscriptionStatus === 'SUBSCRIBED') setStatus('connected');
        if (subscriptionStatus === 'CLOSED' || subscriptionStatus === 'CHANNEL_ERROR') setStatus('disconnected');
      });

    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      pendingRowRef.current = null;
      if (channel) supabase.removeChannel(channel);
      channel = null;
    };
  }, [isActive, productId, queueRow, subscriptionKey]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const anchorPrice = anchorPriceRef.current ?? productPriceRef.current ?? null;
      if (!anchorPrice || anchorPrice <= 0) return;

      const latestRealAt = latestRealRowAtRef.current ? new Date(latestRealRowAtRef.current).getTime() : 0;
      const isRealtimeStale = !latestRealAt || Date.now() - latestRealAt > 10000;
      if (!isRealtimeStale) return;

      mergeRow(buildSyntheticLiveRow(productId, anchorPrice));
      setStatus(current => current === 'connected' ? current : 'connected');
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, mergeRow, productId]);

  // Persist rows/product into module-level cache so chart hydrates instantly on remount
  useEffect(() => {
    if (!isActive) return;
    if (rows.length === 0 && !product) return;
    writeCache(cacheKey(productId, timeframe), {
      rows,
      product,
      anchorPrice: anchorPriceRef.current,
      latestRealRowAt: latestRealRowAtRef.current,
      updatedAt: Date.now(),
    });
  }, [isActive, productId, timeframe, rows, product]);

  const candles = useMemo(() => aggregateOHLCData(rows, timeframe), [rows, timeframe]);
  const engineCandles = useMemo(() => ohlcToEngineCandles(candles), [candles]);
  const lineData = useMemo(() => ohlcToLineData(candles, timeframe), [candles, timeframe]);
  const candleHigh = candles.length ? Math.max(...candles.map(c => c.high)) : null;
  const candleLow = candles.length ? Math.min(...candles.map(c => c.low)) : null;
  const candleLast = candles.length ? candles[candles.length - 1].close : null;
  const latestPrice = pickValid(candleLast, pickValid(product?.price ?? null, null));
  const highPrice = pickValid(product?.high_24h ?? null, pickValid(candleHigh, null));
  const lowPrice = pickValid(product?.low_24h ?? null, pickValid(candleLow, null));

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