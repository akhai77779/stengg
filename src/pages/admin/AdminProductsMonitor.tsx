import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CandlestickChart, OHLCData, CandlestickChartRef } from '@/components/charts/CandlestickChart';
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, ExternalLink,
  WifiOff, Play, Pause, SkipForward, SkipBack, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Timeframe = '1m' | '5m' | '15m' | '1h';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
];

// Playback speeds: how many minutes of data to advance per tick
const PLAYBACK_SPEEDS = [
  { label: '1×', minutesPerTick: 1 },
  { label: '5×', minutesPerTick: 5 },
  { label: '30×', minutesPerTick: 30 },
];

// Tick interval in ms
const TICK_MS = 1500;

interface Product {
  id: string;
  name: string;
  symbol: string | null;
  price: number | null;
  price_change: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume: string | null;
  category: string | null;
  image_url: string | null;
}

interface ProductWithChart extends Product {
  ohlcData: OHLCData[];
  playbackPrice: number | null;
  playbackChange: number | null;
  isLoading: boolean;
}

// All raw candles per product for playback
interface ProductRawData {
  id: string;
  rows: { recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number }[];
}

// ─── Drag Scrubber Component ─────────────────────────────────────────────────
function DragScrubber({
  progress,         // 0-100
  cursorMs,
  startMs,
  endMs,
  onSeek,           // (ratio: 0-1) => void
  onDragStart,
  onDragEnd,
}: {
  progress: number;
  cursorMs: number;
  startMs: number;
  endMs: number;
  onSeek: (ratio: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const getRatioFromEvent = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  // Mouse events
  useLayoutEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      onSeek(getRatioFromEvent(e.clientX));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      onSeek(getRatioFromEvent(e.clientX));
      onDragEnd?.();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [getRatioFromEvent, onSeek, onDragEnd]);

  // Touch events
  useLayoutEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();
      onSeek(getRatioFromEvent(e.touches[0].clientX));
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      onSeek(getRatioFromEvent(e.changedTouches[0].clientX));
      onDragEnd?.();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [getRatioFromEvent, onSeek, onDragEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    onDragStart?.();
    onSeek(getRatioFromEvent(e.clientX));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    onDragStart?.();
    onSeek(getRatioFromEvent(e.touches[0].clientX));
  };

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className="space-y-2">
      {/* Time labels */}
      <div className="flex items-center justify-between text-xs text-muted-foreground select-none">
        <span className="font-mono">00:00</span>
        <span className="font-mono font-semibold text-foreground text-sm tabular-nums">
          {formatTime(cursorMs)} <span className="text-muted-foreground text-xs">UTC</span>
        </span>
        <span className="font-mono">23:59</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative w-full h-5 flex items-center cursor-pointer group select-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-muted overflow-hidden top-1/2 -translate-y-1/2">
          {/* Filled portion */}
          <div
            className="h-full rounded-full bg-primary transition-none"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className="absolute -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-md transition-none z-10
                     group-hover:scale-125 group-active:scale-110"
          style={{ left: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = [
  'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
  'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  'from-amber-500/20 to-amber-600/5 border-amber-500/30',
  'from-rose-500/20 to-rose-600/5 border-rose-500/30',
  'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
  'from-indigo-500/20 to-indigo-600/5 border-indigo-500/30',
  'from-orange-500/20 to-orange-600/5 border-orange-500/30',
  'from-teal-500/20 to-teal-600/5 border-teal-500/30',
  'from-pink-500/20 to-pink-600/5 border-pink-500/30',
];

function formatPrice(price: number | null) {
  if (price === null || price === undefined) return '$0.00';
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(2);
  return '$' + price.toFixed(4);
}

function formatChange(change: number | null) {
  if (!change) return '0.00';
  return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
}

function formatVolume(volume: string | null) {
  if (!volume || volume === '0' || volume === 'null') return '-';
  const num = parseFloat(volume.replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num === 0) return '-';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// Aggregate raw 1m rows into OHLC based on timeframe
function aggregateOHLC(
  rows: { recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number }[],
  tf: Timeframe
): OHLCData[] {
  const minutesPerBucket = tf === '1m' ? 1 : tf === '5m' ? 5 : tf === '15m' ? 15 : 60;
  if (minutesPerBucket === 1) {
    return rows.map(r => ({ time: r.recorded_at, open: r.open_price, high: r.high_price, low: r.low_price, close: r.close_price }));
  }
  const buckets = new Map<number, { open: number; high: number; low: number; close: number; time: string }>();
  for (const r of rows) {
    const ts = new Date(r.recorded_at).getTime();
    const bucketMs = minutesPerBucket * 60 * 1000;
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, { time: new Date(bucketKey).toISOString(), open: r.open_price, high: r.high_price, low: r.low_price, close: r.close_price });
    } else {
      existing.high = Math.max(existing.high, r.high_price);
      existing.low = Math.min(existing.low, r.low_price);
      existing.close = r.close_price;
    }
  }
  return Array.from(buckets.values()).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

function ProductChartCard({
  product,
  colorClass,
  isPlayback,
}: {
  product: ProductWithChart;
  colorClass: string;
  isPlayback: boolean;
}) {
  const chartRef = useRef<CandlestickChartRef>(null);
  const displayPrice = isPlayback ? product.playbackPrice : product.price;
  const displayChange = isPlayback ? product.playbackChange : product.price_change;
  const isPositive = (displayChange || 0) >= 0;

  return (
    <Card className={cn('relative overflow-hidden border bg-gradient-to-br transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5', colorClass)}>
      {/* Header */}
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
              ) : (
                <Activity className="w-4 h-4 text-primary flex-shrink-0" />
              )}
              <h3 className="font-semibold text-sm text-foreground truncate leading-tight">{product.name}</h3>
            </div>
            {product.symbol && <span className="text-xs text-muted-foreground font-mono">{product.symbol}</span>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-base font-bold text-foreground font-mono tabular-nums">{formatPrice(displayPrice)}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs px-1.5 py-0 h-5 font-mono font-medium border',
                isPositive ? 'bg-green-500/15 text-green-400 border-green-500/40' : 'bg-red-500/15 text-red-400 border-red-500/40'
              )}
            >
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {formatChange(displayChange)}%
            </Badge>
          </div>
        </div>
        {/* 24h stats */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>H:</span>
            <span className="text-green-400 font-mono">{formatPrice(product.high_24h)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>L:</span>
            <span className="text-red-400 font-mono">{formatPrice(product.low_24h)}</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span>VOL:</span>
            <span className="text-foreground font-mono">{formatVolume(product.volume)}</span>
          </div>
        </div>
      </CardHeader>

      {/* Chart */}
      <CardContent className="px-2 pb-3 pt-0">
        {product.isLoading ? (
          <div className="h-[160px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-xs">Đang tải...</span>
            </div>
          </div>
        ) : product.ohlcData.length === 0 ? (
          <div className="h-[160px] flex items-center justify-center text-muted-foreground text-xs">
            Chưa có dữ liệu OHLC
          </div>
        ) : (
          <CandlestickChart
            ref={chartRef}
            data={product.ohlcData}
            height={160}
            indicatorConfig={{ ma: { enabled: false, period: 7, color: '#f59e0b' }, ema: { enabled: false, period: 25, color: '#8b5cf6' } }}
          />
        )}
      </CardContent>

      {/* Footer */}
      <div className="px-4 pb-3">
        <Link to={`/products/${product.id}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <ExternalLink className="w-3 h-3" />
          Xem giao dịch
        </Link>
      </div>
    </Card>
  );
}

export default function AdminProductsMonitor() {
  const [products, setProducts] = useState<ProductWithChart[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [isChangingTimeframe, setIsChangingTimeframe] = useState(false);

  // --- Playback state ---
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [availableDays, setAvailableDays] = useState<string[]>([]); // sorted list of DATE strings
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [playbackCursorMs, setPlaybackCursorMs] = useState<number>(0); // current timestamp within the day
  const [speedIndex, setSpeedIndex] = useState(0); // index into PLAYBACK_SPEEDS
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0-100
  const [dayStartMs, setDayStartMs] = useState(0);
  const [dayEndMs, setDayEndMs] = useState(0);

  // Raw all-data cache per product (loaded once for all days)
  const rawDataRef = useRef<ProductRawData[]>([]);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch OHLC from local price_history for LIVE mode
  const fetchOHLCLocal = useCallback(async (productId: string, tf: Timeframe): Promise<OHLCData[]> => {
    const minutesPerBucket = tf === '1m' ? 1 : tf === '5m' ? 5 : tf === '15m' ? 15 : 60;
    const limit = tf === '1m' ? 80 : 160;
    const { data: rows } = await supabase
      .from('price_history')
      .select('open_price, high_price, low_price, close_price, recorded_at')
      .eq('product_id', productId)
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (!rows || rows.length === 0) return [];
    const sorted = [...rows].reverse();
    if (minutesPerBucket === 1) {
      return sorted.map(r => ({ time: r.recorded_at, open: r.open_price, high: r.high_price, low: r.low_price, close: r.close_price }));
    }
    const buckets = new Map<number, { open: number; high: number; low: number; close: number; time: string }>();
    for (const r of sorted) {
      const ts = new Date(r.recorded_at).getTime();
      const bucketMs = minutesPerBucket * 60 * 1000;
      const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
      const existing = buckets.get(bucketKey);
      if (!existing) {
        buckets.set(bucketKey, { time: new Date(bucketKey).toISOString(), open: r.open_price, high: r.high_price, low: r.low_price, close: r.close_price });
      } else {
        existing.high = Math.max(existing.high, r.high_price);
        existing.low = Math.min(existing.low, r.low_price);
        existing.close = r.close_price;
      }
    }
    return Array.from(buckets.values()).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, []);

  // Load top 10 products (LIVE mode)
  const loadProducts = useCallback(async (tf: Timeframe) => {
    setIsLoadingList(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, symbol, price, price_change, high_24h, low_24h, volume, category, image_url')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !data) { setIsLoadingList(false); return; }
    setProducts(data.map(p => ({ ...p, ohlcData: [], playbackPrice: null, playbackChange: null, isLoading: true })));
    setIsLoadingList(false);
    const ohlcResults = await Promise.all(data.map(p => fetchOHLCLocal(p.id, tf)));
    setProducts(data.map((p, i) => ({ ...p, ohlcData: ohlcResults[i], playbackPrice: null, playbackChange: null, isLoading: false })));
    setLastUpdated(new Date());
  }, [fetchOHLCLocal]);

  useEffect(() => {
    if (!isPlaybackMode) loadProducts(timeframe);
  }, [loadProducts, timeframe, isPlaybackMode]);

  // Handle timeframe change
  const handleTimeframeChange = useCallback(async (tf: Timeframe) => {
    if (tf === timeframe) return;
    setIsChangingTimeframe(true);
    setProducts(prev => prev.map(p => ({ ...p, ohlcData: [], isLoading: true })));
    setTimeframe(tf);
    setTimeout(() => setIsChangingTimeframe(false), 500);
  }, [timeframe]);

  // --- PLAYBACK FUNCTIONS ---

  // Load all raw data from DB for playback (all records, all products)
  const loadPlaybackData = useCallback(async () => {
    setIsLoadingList(true);
    // 1. Get product list
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, symbol, price, price_change, high_24h, low_24h, volume, category, image_url')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(10);
    if (!productData) { setIsLoadingList(false); return; }

    setProducts(productData.map(p => ({
      ...p, ohlcData: [], playbackPrice: p.price, playbackChange: p.price_change, isLoading: true
    })));

    // 2. Get distinct days
    const { data: dayRows } = await supabase
      .from('price_history')
      .select('recorded_at')
      .order('recorded_at', { ascending: true })
      .limit(1);
    
    // Fetch all records for each product (up to limit)
    const allRaw: ProductRawData[] = await Promise.all(productData.map(async (p) => {
      const { data: rows } = await supabase
        .from('price_history')
        .select('recorded_at, open_price, high_price, low_price, close_price')
        .eq('product_id', p.id)
        .order('recorded_at', { ascending: true })
        .limit(20000);
      return { id: p.id, rows: rows || [] };
    }));

    rawDataRef.current = allRaw;

    // 3. Compute available days from first product's data (or union)
    const daySet = new Set<string>();
    for (const pd of allRaw) {
      for (const r of pd.rows) {
        daySet.add(r.recorded_at.slice(0, 10));
      }
    }
    const days = Array.from(daySet).sort();
    setAvailableDays(days);

    // 4. Start at day 0, cursor = start of day
    const firstDay = days[0];
    const startMs = new Date(firstDay + 'T00:00:00Z').getTime();
    const endMs = new Date(firstDay + 'T23:59:59Z').getTime();
    setCurrentDayIndex(0);
    setPlaybackCursorMs(startMs);
    setDayStartMs(startMs);
    setDayEndMs(endMs);

    // 5. Render initial slice (show first 80 candles max)
    const maxCandles = timeframe === '1m' ? 80 : timeframe === '5m' ? 80 : timeframe === '15m' ? 60 : 40;
    const minutesPerBucket = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : 60;
    const windowMs = maxCandles * minutesPerBucket * 60 * 1000;
    const initCursor = startMs + 60 * 1000;
    setProducts(productData.map((p, i) => {
      const raw = allRaw[i];
      const sliced = raw.rows.filter(r => {
        const t = new Date(r.recorded_at).getTime();
        return t <= initCursor && t >= (initCursor - windowMs);
      });
      const ohlcData = aggregateOHLC(sliced, timeframe);
      const lastClose = sliced.length > 0 ? sliced[sliced.length - 1].close_price : p.price;
      return { ...p, ohlcData, playbackPrice: lastClose, playbackChange: null, isLoading: false };
    }));

    setIsLoadingList(false);
    setLastUpdated(new Date());
  }, [timeframe]);

  // Re-render charts for a given cursor position
  const renderAtCursor = useCallback((cursorMs: number, pData: typeof products) => {
    const raw = rawDataRef.current;
    if (!raw.length) return;

    // Max candles to display per timeframe (keep chart tight and readable)
    const maxCandles = timeframe === '1m' ? 80 : timeframe === '5m' ? 80 : timeframe === '15m' ? 60 : 40;
    const minutesPerBucket = timeframe === '1m' ? 1 : timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : 60;
    const windowMs = maxCandles * minutesPerBucket * 60 * 1000;
    const windowStart = cursorMs - windowMs;

    setProducts(prev => prev.map((p) => {
      const rd = raw.find(r => r.id === p.id);
      if (!rd) return p;
      // Only rows up to cursor, within the sliding window
      const sliced = rd.rows.filter(r => {
        const t = new Date(r.recorded_at).getTime();
        return t <= cursorMs && t >= windowStart;
      });
      const ohlcData = aggregateOHLC(sliced, timeframe);
      const lastRow = sliced.length > 0 ? sliced[sliced.length - 1] : null;
      const lastClose = lastRow ? lastRow.close_price : p.price;
      const firstClose = sliced.length > 1 ? sliced[0].close_price : lastClose;
      const pctChange = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;
      return { ...p, ohlcData, playbackPrice: lastClose, playbackChange: pctChange, isLoading: false };
    }));
  }, [timeframe]);

  // Advance cursor by N minutes, handle day boundary
  const advanceCursor = useCallback((currentCursor: number, currentDayIdx: number, days: string[], minutesPerTick: number): { newCursor: number; newDayIdx: number; newStart: number; newEnd: number } => {
    const newCursor = currentCursor + minutesPerTick * 60 * 1000;
    const currentDayEnd = new Date(days[currentDayIdx] + 'T23:59:59Z').getTime();

    if (newCursor > currentDayEnd) {
      // Advance to next day (loop if at end)
      const nextDayIdx = (currentDayIdx + 1) % days.length;
      const nextDay = days[nextDayIdx];
      const newStart = new Date(nextDay + 'T00:00:00Z').getTime();
      const newEnd = new Date(nextDay + 'T23:59:59Z').getTime();
      return { newCursor: newStart, newDayIdx: nextDayIdx, newStart, newEnd };
    }

    const start = new Date(days[currentDayIdx] + 'T00:00:00Z').getTime();
    const end = currentDayEnd;
    return { newCursor, newDayIdx: currentDayIdx, newStart: start, newEnd: end };
  }, []);

  // Playback tick
  useEffect(() => {
    if (!isPlaybackMode || !isPlaying || availableDays.length === 0) return;

    const speed = PLAYBACK_SPEEDS[speedIndex];

    // Use refs to avoid stale closure
    let cursor = playbackCursorMs;
    let dayIdx = currentDayIndex;
    let startMs = dayStartMs;
    let endMs = dayEndMs;

    playbackTimerRef.current = setInterval(() => {
      const { newCursor, newDayIdx, newStart, newEnd } = advanceCursor(cursor, dayIdx, availableDays, speed.minutesPerTick);
      cursor = newCursor;
      dayIdx = newDayIdx;
      startMs = newStart;
      endMs = newEnd;

      setPlaybackCursorMs(newCursor);
      setCurrentDayIndex(newDayIdx);
      setDayStartMs(newStart);
      setDayEndMs(newEnd);

      const progress = endMs > newStart ? ((newCursor - newStart) / (endMs - newStart)) * 100 : 0;
      setPlaybackProgress(Math.min(100, progress));
      setLastUpdated(new Date(newCursor));

      renderAtCursor(newCursor, []);
    }, TICK_MS);

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaybackMode, isPlaying, speedIndex, availableDays]);

  // Toggle playback mode
  const togglePlaybackMode = useCallback(async () => {
    if (!isPlaybackMode) {
      setIsPlaying(false);
      setIsPlaybackMode(true);
      await loadPlaybackData();
    } else {
      setIsPlaying(false);
      setIsPlaybackMode(false);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      loadProducts(timeframe);
    }
  }, [isPlaybackMode, loadPlaybackData, loadProducts, timeframe]);

  // Navigate to specific day
  const goToDay = useCallback((dayIdx: number) => {
    if (availableDays.length === 0) return;
    const day = availableDays[dayIdx];
    const newStart = new Date(day + 'T00:00:00Z').getTime();
    const newEnd = new Date(day + 'T23:59:59Z').getTime();
    setCurrentDayIndex(dayIdx);
    setPlaybackCursorMs(newStart);
    setDayStartMs(newStart);
    setDayEndMs(newEnd);
    setPlaybackProgress(0);
    renderAtCursor(newStart, []);
  }, [availableDays, renderAtCursor]);

  // Realtime: product price updates (LIVE mode only)
  useEffect(() => {
    if (isPlaybackMode) return;
    const channel = supabase
      .channel('admin-monitor-products')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...(payload.new as Product) } : p));
        setLastUpdated(new Date());
      })
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));
    return () => { supabase.removeChannel(channel); };
  }, [isPlaybackMode]);

  // Realtime: price_history for 1m (LIVE mode only)
  useEffect(() => {
    if (isPlaybackMode || timeframe !== '1m') return;
    const channel = supabase
      .channel('admin-monitor-price-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history' }, (payload) => {
        const newRow = payload.new as { product_id: string; recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number };
        if (!newRow?.product_id) return;
        setProducts(prev => prev.map(p => {
          if (p.id !== newRow.product_id) return p;
          const newCandle: OHLCData = { time: newRow.recorded_at, open: newRow.open_price, high: newRow.high_price, low: newRow.low_price, close: newRow.close_price };
          const idx = p.ohlcData.findIndex(c => c.time === newCandle.time);
          const updated = idx >= 0 ? p.ohlcData.map((c, i) => i === idx ? newCandle : c) : [...p.ohlcData.slice(-79), newCandle];
          return { ...p, ohlcData: updated };
        }));
        setLastUpdated(new Date());
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [timeframe, isPlaybackMode]);

  // Format date nicely
  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Format cursor time
  const formatCursorTime = (ms: number) => {
    const d = new Date(ms);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gradient">Market Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isPlaybackMode ? 'Chế độ phát lại lịch sử — dữ liệu từ database' : 'Biểu đồ nến live của 10 sản phẩm — dữ liệu realtime'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe selector (live mode only) */}
          {!isPlaybackMode && (
            <div className="flex items-center bg-muted/60 rounded-lg p-1 gap-0.5">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => handleTimeframeChange(tf.value)}
                  disabled={isChangingTimeframe}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 min-w-[40px]',
                    timeframe === tf.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}

          {/* Playback mode toggle */}
          <Button
            size="sm"
            variant={isPlaybackMode ? 'default' : 'outline'}
            onClick={togglePlaybackMode}
            disabled={isLoadingList}
            className="gap-1.5 h-8"
          >
            <History className="w-3.5 h-3.5" />
            {isPlaybackMode ? 'Thoát Playback' : 'Phát lại'}
          </Button>

          {/* Realtime indicator (live mode) */}
          {!isPlaybackMode && (
            <div className="flex items-center gap-1.5 text-xs">
              {realtimeConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-green-400 font-medium">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Offline</span>
                </>
              )}
            </div>
          )}

          {lastUpdated && !isPlaybackMode && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {lastUpdated.toLocaleTimeString('vi-VN')}
            </span>
          )}

          {!isPlaybackMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadProducts(timeframe)}
              disabled={isLoadingList || isChangingTimeframe}
              className="gap-2 h-8"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', (isLoadingList || isChangingTimeframe) && 'animate-spin')} />
              Làm mới
            </Button>
          )}
        </div>
      </div>

      {/* ===== PLAYBACK CONTROLS ===== */}
      {isPlaybackMode && availableDays.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {/* Day navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Ngày:</span>
            {availableDays.map((day, idx) => (
              <button
                key={day}
                onClick={() => goToDay(idx)}
                className={cn(
                  'px-3 py-1 text-xs rounded-lg font-semibold transition-all border',
                  currentDayIndex === idx
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/60 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                )}
              >
                {formatDay(day)}
              </button>
            ))}
          </div>

          {/* Drag Scrubber */}
          <DragScrubber
            progress={playbackProgress}
            cursorMs={playbackCursorMs}
            startMs={dayStartMs}
            endMs={dayEndMs}
            onDragStart={() => setIsPlaying(false)}
            onSeek={(ratio) => {
              const newCursor = dayStartMs + ratio * (dayEndMs - dayStartMs);
              setPlaybackCursorMs(newCursor);
              setPlaybackProgress(ratio * 100);
              setLastUpdated(new Date(newCursor));
              renderAtCursor(newCursor, []);
            }}
          />

          {/* Controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Prev day */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => goToDay((currentDayIndex - 1 + availableDays.length) % availableDays.length)}
            >
              <SkipBack className="w-3.5 h-3.5" />
            </Button>

            {/* Play/Pause */}
            <Button
              size="sm"
              variant="default"
              className="h-8 px-4 gap-2"
              onClick={() => setIsPlaying(p => !p)}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Tạm dừng' : 'Phát'}
            </Button>

            {/* Next day */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => goToDay((currentDayIndex + 1) % availableDays.length)}
            >
              <SkipForward className="w-3.5 h-3.5" />
            </Button>

            {/* Speed selector */}
            <div className="flex items-center bg-muted/60 rounded-lg p-1 gap-0.5 ml-auto">
              <span className="text-xs text-muted-foreground px-2">Tốc độ:</span>
              {PLAYBACK_SPEEDS.map((s, idx) => (
                <button
                  key={s.label}
                  onClick={() => setSpeedIndex(idx)}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200',
                    speedIndex === idx
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Timeframe in playback */}
            <div className="flex items-center bg-muted/60 rounded-lg p-1 gap-0.5">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-200',
                    timeframe === tf.value
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-xs">
            <div className={cn('w-2 h-2 rounded-full', isPlaying ? 'bg-amber-400 animate-pulse' : 'bg-muted-foreground')} />
            <span className="text-muted-foreground">
              {isPlaying ? `Đang phát — ${PLAYBACK_SPEEDS[speedIndex].minutesPerTick} phút/tick` : 'Đã tạm dừng'}
            </span>
            <span className="ml-auto text-muted-foreground">
              Loop: Khi hết <span className="text-foreground font-medium">{availableDays[availableDays.length - 1] ? formatDay(availableDays[availableDays.length - 1]) : ''}</span> → quay về <span className="text-foreground font-medium">{availableDays[0] ? formatDay(availableDays[0]) : ''}</span>
            </span>
          </div>
        </div>
      )}

      {/* Summary Stats Bar */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sản phẩm', value: products.length, suffix: '/10', color: 'text-primary' },
            { label: 'Tăng', value: products.filter(p => ((isPlaybackMode ? p.playbackChange : p.price_change) || 0) >= 0).length, suffix: '', color: 'text-green-400' },
            { label: 'Giảm', value: products.filter(p => ((isPlaybackMode ? p.playbackChange : p.price_change) || 0) < 0).length, suffix: '', color: 'text-red-400' },
            { label: 'Có biểu đồ', value: products.filter(p => p.ohlcData.length > 0).length, suffix: '', color: 'text-amber-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className={cn('text-lg font-bold font-mono', stat.color)}>
                {stat.value}
                {stat.suffix && <span className="text-xs text-muted-foreground">{stat.suffix}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart Grid */}
      {isLoadingList ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-[160px] bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Chưa có sản phẩm nào.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {products.map((product, index) => (
            <ProductChartCard
              key={product.id}
              product={product}
              colorClass={COLORS[index % COLORS.length]}
              isPlayback={isPlaybackMode}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
        {isPlaybackMode
          ? <>Playback — <code className="bg-muted px-1 rounded">price_history</code> {availableDays.length} ngày, loop tự động</>
          : <>Khung thời gian: <span className="font-semibold text-foreground">{timeframe}</span> — dữ liệu từ <code className="bg-muted px-1 rounded">price_history</code></>
        }
      </p>
    </div>
  );
}
