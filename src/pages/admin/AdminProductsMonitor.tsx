import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Maximize2,
  RefreshCw,
} from 'lucide-react';

import { CandlestickChart, OHLCData } from '@/components/charts/CandlestickChart';
import { TechnicalIndicatorsPanel } from '@/components/charts/TechnicalIndicatorsPanel';
import { TimeIntervalSelector } from '@/components/charts/TimeIntervalSelector';
import { ExportButton } from '@/components/charts/ExportButton';
import { ShareButton } from '@/components/charts/ShareButton';

import { calculateSMA, calculateRSI, calculateMACD } from '@/lib/chartUtils';
import { TimeInterval, Candle, TechnicalIndicators } from '@/types/trading';
import { PriceVolatilityControl } from '@/components/admin/PriceVolatilityControl';

interface DBProduct {
  id: string;
  name: string;
  symbol: string | null;
  price: number | null;
  price_change: number | null;
  high_24h: number | null;
  low_24h: number | null;
  volume: string | null;
  image_url: string | null;
}

type Timeframe = '1M' | '5M' | '15M' | '30M' | '1H' | '1D';

function formatPrice(price: number | null) {
  if (price === null || price === undefined) return '$0.00';
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return '$' + price.toFixed(2);
  return '$' + price.toFixed(4);
}

// Aggregate raw 1m rows into OHLC based on timeframe
function aggregateOHLC(
  rows: { recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number }[],
  tf: Timeframe
): OHLCData[] {
  const minutesMap: Record<Timeframe, number> = { '1M': 1, '5M': 5, '15M': 15, '30M': 30, '1H': 60, '1D': 1440 };
  const minutesPerBucket = minutesMap[tf];

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

export default function AdminProductsMonitor() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('1M');
  const [products, setProducts] = useState<DBProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);

  // Replay state
  const [allCandles, setAllCandles] = useState<OHLCData[]>([]);
  const [displayIndex, setDisplayIndex] = useState(0);
  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const displayIndexKey = `monitor_idx_${selectedProductId}_${timeInterval}`;

  const WINDOW_SIZE = 120;
  const REPLAY_SPEED = 2000; // 2s per candle

  // Persist displayIndex to localStorage on change
  useEffect(() => {
    if (displayIndex > 0 && selectedProductId) {
      localStorage.setItem(displayIndexKey, String(displayIndex));
    }
  }, [displayIndex, displayIndexKey, selectedProductId]);

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, symbol, price, price_change, high_24h, low_24h, volume, image_url')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setProducts(data);
        const saved = localStorage.getItem('admin_monitor_product');
        if (saved && data.find(p => p.id === saved)) {
          setSelectedProductId(saved);
        } else if (data.length > 0) {
          setSelectedProductId(data[0].id);
        }
      }
      setIsLoading(false);
    };
    loadProducts();
    const savedTf = localStorage.getItem('admin_monitor_timeframe') as TimeInterval;
    if (savedTf) setTimeInterval(savedTf);
  }, []);

  // Fetch ALL OHLC data for replay
  const fetchAllOHLC = useCallback(async (productId: string, tf: TimeInterval) => {
    setIsChartLoading(true);
    const { data: rows } = await supabase
      .from('price_history')
      .select('open_price, high_price, low_price, close_price, recorded_at')
      .eq('product_id', productId)
      .order('recorded_at', { ascending: true })
      .limit(1000);

    if (rows && rows.length > 0) {
      const aggregated = aggregateOHLC(rows, tf);
      setAllCandles(aggregated);
      // Restore saved position or start from WINDOW_SIZE
      const key = `monitor_idx_${productId}_${tf}`;
      const saved = parseInt(localStorage.getItem(key) || '0', 10);
      const restored = saved > 0 && saved <= aggregated.length ? saved : Math.min(WINDOW_SIZE, aggregated.length);
      setDisplayIndex(restored);
    } else {
      setAllCandles([]);
      setDisplayIndex(0);
    }
    setIsChartLoading(false);
  }, []);

  useEffect(() => {
    if (selectedProductId) fetchAllOHLC(selectedProductId, timeInterval);
  }, [selectedProductId, timeInterval, fetchAllOHLC]);

  // Realtime product price updates
  useEffect(() => {
    const channel = supabase
      .channel('products-monitor')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as DBProduct : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Replay: advance index every 2s, loop when done
  useEffect(() => {
    if (replayRef.current) clearInterval(replayRef.current);
    if (allCandles.length === 0 || isChartLoading) return;

    replayRef.current = setInterval(() => {
      setDisplayIndex(prev => {
        if (prev >= allCandles.length) {
          return Math.min(WINDOW_SIZE, allCandles.length); // loop back
        }
        return prev + 1;
      });
    }, REPLAY_SPEED);

    return () => { if (replayRef.current) clearInterval(replayRef.current); };
  }, [allCandles, isChartLoading]);

  // Visible chart = sliding window
  const chartData = useMemo(() => {
    if (allCandles.length === 0) return [];
    const end = displayIndex;
    const start = Math.max(0, end - WINDOW_SIZE);
    return allCandles.slice(start, end);
  }, [allCandles, displayIndex]);

  const latestPrice = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData[chartData.length - 1].close;
  }, [chartData]);

  const selectedProduct = useMemo(() => {
    const product = products.find(p => p.id === selectedProductId) || null;
    if (product && latestPrice !== null) {
      return { ...product, price: latestPrice };
    }
    return product;
  }, [products, selectedProductId, latestPrice]);

  // Convert OHLCData to Candle[] for indicators & export
  const displayCandles: Candle[] = useMemo(() => {
    return chartData.map(c => ({
      time: Math.floor(new Date(c.time).getTime() / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: 0,
    }));
  }, [chartData]);

  const technicalIndicators = useMemo((): TechnicalIndicators | null => {
    if (displayCandles.length < 50) return null;
    const closes = displayCandles.map(c => c.close);
    return {
      ma20: calculateSMA(closes, 20),
      ma50: calculateSMA(closes, 50),
      rsi: calculateRSI(closes, 14),
      macd: calculateMACD(closes),
    };
  }, [displayCandles]);

  const handleProductSelect = useCallback((productId: string) => {
    setSelectedProductId(productId);
    localStorage.setItem('admin_monitor_product', productId);
  }, []);

  const handleTimeframeChange = useCallback((interval: TimeInterval) => {
    setTimeInterval(interval);
    localStorage.setItem('admin_monitor_timeframe', interval);
  }, []);

  const handleRefresh = useCallback(() => {
    if (selectedProductId) fetchAllOHLC(selectedProductId, timeInterval);
  }, [selectedProductId, timeInterval, fetchAllOHLC]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Đang tải sản phẩm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Product Chart Monitor</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time candlestick charts with technical analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-green-500 border-green-500/40">
            <Activity className="w-3 h-3" />
            Live
          </Badge>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setIsFullscreen(f => !f)}>
            {isFullscreen ? <Eye className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Product Sidebar */}
        <div className="w-72 flex-shrink-0 border rounded-lg bg-card">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold text-foreground">
              Sản phẩm ({products.length})
            </h2>
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="p-2 space-y-1">
              {products.map((product) => {
                const isSelected = selectedProductId === product.id;
                const change = product.price_change || 0;

                return (
                  <button
                    key={product.id}
                    onClick={() => handleProductSelect(product.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                      ) : (
                        <Activity className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                      <div className="flex-1 ml-2 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.symbol || '-'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground font-mono">
                          {formatPrice(product.price)}
                        </p>
                        <p className={`text-xs font-mono flex items-center gap-0.5 justify-end ${
                          change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(change).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Chart Area */}
        <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
          {selectedProduct ? (
            <>
              {/* Chart Header */}
              <div className="p-3 border-b">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    {selectedProduct.image_url ? (
                      <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <Activity className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <h2 className="text-base font-bold text-foreground">{selectedProduct.name}</h2>
                      <p className="text-xs text-muted-foreground font-mono">{selectedProduct.symbol || '-'}</p>
                    </div>
                    <div className="ml-4">
                      <p className="text-lg font-bold text-foreground font-mono tabular-nums">
                        {formatPrice(selectedProduct.price)}
                      </p>
                      {technicalIndicators && (
                        <p className="text-xs text-muted-foreground font-mono">
                          RSI: {technicalIndicators.rsi.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TimeIntervalSelector value={timeInterval} onChange={handleTimeframeChange} />
                    {displayCandles.length > 0 && (
                      <>
                        <ExportButton candles={displayCandles} productName={selectedProduct.name} />
                        <ShareButton productId={selectedProduct.id} productName={selectedProduct.name} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Candlestick Chart */}
              <div className="flex-1 p-2 min-h-0">
                {isChartLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Chưa có dữ liệu OHLC cho sản phẩm này
                  </div>
                ) : (
                  <CandlestickChart
                    data={chartData}
                    height={isFullscreen ? 500 : 380}
                    indicatorConfig={{
                      ma: { enabled: true, period: 20, color: '#3b82f6' },
                      ema: { enabled: true, period: 12, color: '#f59e0b' },
                    }}
                  />
                )}
              </div>

              {/* Technical Indicators + Price Control */}
              <div className="px-3 pb-3 flex gap-3 flex-wrap">
                {technicalIndicators && (
                  <div className="flex-1 min-w-[200px]">
                    <TechnicalIndicatorsPanel indicators={technicalIndicators} />
                  </div>
                )}
                <div className="w-64 flex-shrink-0">
                  <PriceVolatilityControl productId={selectedProduct.id} productName={selectedProduct.name} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <BarChart3 className="w-12 h-12 opacity-30" />
              <h3 className="text-lg font-medium">Chọn sản phẩm</h3>
              <p className="text-sm">Chọn một sản phẩm từ sidebar để xem biểu đồ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
