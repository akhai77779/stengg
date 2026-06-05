import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Eye,
  Maximize2,
  Zap,
  History,
  Loader2,
} from 'lucide-react';

import { CandlestickChart } from '@/components/charts/CandlestickChart';
import { TechnicalIndicatorsPanel } from '@/components/charts/TechnicalIndicatorsPanel';
import { TimeIntervalSelector } from '@/components/charts/TimeIntervalSelector';
import { ShareButton } from '@/components/charts/ShareButton';

import { calculateSMA, calculateRSI, calculateMACD } from '@/lib/chartUtils';
import { TimeInterval, TechnicalIndicators } from '@/types/trading';
import { SharedTimeframe, useSharedProductRealtime, clearSharedProductCache } from '@/hooks/useSharedProductRealtime';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const ADMIN_TIMEFRAME_MAP: Record<TimeInterval, SharedTimeframe> = {
  '1M': '1m',
  '5M': '5m',
  '15M': '15m',
  '30M': '30m',
  '1H': '1h',
  '1D': '1d',
};

interface DbProduct {
  id: string;
  name: string;
  symbol: string | null;
  price: number | null;
  price_change: number | null;
  high_24h: number | null;
  low_24h: number | null;
}

export default function AdminProductsMonitor() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    () => localStorage.getItem('admin_monitor_product') || null
  );
  const [timeInterval, setTimeInterval] = useState<TimeInterval>(
    () => (localStorage.getItem('admin_monitor_timeframe') as TimeInterval) || '1M'
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [pendingShockCount, setPendingShockCount] = useState(0);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [chartReloadToken, setChartReloadToken] = useState(0);

  const handleBackfill = useCallback(async () => {
    if (isBackfilling) return;
    if (!confirm('Backfill 30 ngày dữ liệu nến cho TẤT CẢ sản phẩm? Quá trình có thể mất 1-3 phút.')) return;
    setIsBackfilling(true);
    try {
      // Process one product per invocation to avoid the 150s edge function timeout.
      const { data: prodRows, error: prodErr } = await supabase
        .from('products').select('id, name').eq('status', 'available');
      if (prodErr) throw prodErr;
      const list = prodRows || [];
      let done = 0;
      for (const p of list) {
        const { data, error } = await supabase.functions.invoke('backfill-price-history', {
          body: { days: 30, productIds: [p.id] },
        });
        if (error) throw new Error(`${p.name}: ${error.message}`);
        if (data?.ok === false) throw new Error(`${p.name}: ${data.error || 'Backfill failed'}`);
        done += 1;
      }
      // Invalidate cached rows and force the hook to refetch from DB
      clearSharedProductCache();
      setChartReloadToken(t => t + 1);
      toast({
        title: 'Backfill hoàn tất',
        description: `Đã seed ${done}/${list.length} sản phẩm với 30 ngày dữ liệu nến.`,
      });
    } catch (e: any) {
      toast({
        title: 'Backfill thất bại',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    } finally {
      setIsBackfilling(false);
    }
  }, [isBackfilling]);

  // Fetch DB products + subscribe to realtime updates
  useEffect(() => {
    let mounted = true;
    const fetchProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, symbol, price, price_change, high_24h, low_24h')
        .eq('status', 'available')
        .order('name', { ascending: true });
      if (!mounted) return;
      setProducts(data || []);
      setIsReady(true);
    };
    fetchProducts();

    const channel = supabase
      .channel('admin-monitor-products')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          const updated = payload.new as DbProduct;
          setProducts(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)));
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Pending shock_events count (server-side engine)
  useEffect(() => {
    const fetchPending = async () => {
      const { count } = await supabase
        .from('shock_events')
        .select('id', { count: 'exact', head: true })
        .eq('applied', false);
      setPendingShockCount(count || 0);
    };
    fetchPending();
    const channel = supabase
      .channel('admin-monitor-shocks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shock_events' },
        fetchPending
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const effectiveProductId = useMemo(() => {
    if (selectedProductId && products.find(p => p.id === selectedProductId)) {
      return selectedProductId;
    }
    return products.length > 0 ? products[0].id : null;
  }, [selectedProductId, products]);

  const selectedProduct = useMemo(
    () => products.find(p => p.id === effectiveProductId) || null,
    [products, effectiveProductId]
  );

  const sharedRealtime = useSharedProductRealtime({
    productId: effectiveProductId || '',
    timeframe: ADMIN_TIMEFRAME_MAP[timeInterval],
    enabled: !!effectiveProductId,
    throttleMs: 150,
    reloadToken: chartReloadToken,
  });

  const chartOHLCData = sharedRealtime.candles;

  const technicalIndicators = useMemo((): TechnicalIndicators | null => {
    if (chartOHLCData.length < 50) return null;
    const closes = chartOHLCData.map(c => Number(c.close));
    return {
      ma20: calculateSMA(closes, 20),
      ma50: calculateSMA(closes, 50),
      rsi: calculateRSI(closes, 14),
      macd: calculateMACD(closes),
    };
  }, [chartOHLCData]);

  const currentPrice =
    sharedRealtime.latestPrice ?? selectedProduct?.price ?? 0;

  const handleProductSelect = useCallback((productId: string) => {
    setSelectedProductId(productId);
    localStorage.setItem('admin_monitor_product', productId);
  }, []);

  const handleTimeframeChange = useCallback((interval: TimeInterval) => {
    setTimeInterval(interval);
    localStorage.setItem('admin_monitor_timeframe', interval);
  }, []);

  const loadingContent = (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <Activity className="w-8 h-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    </div>
  );

  const content = isReady ? (
    <div className="space-y-3 p-3 md:p-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-lg md:text-xl font-bold text-foreground">Product Chart Monitor</h1>
          </div>
          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            Server-side market engine · price_history is the single source of truth
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={handleBackfill}
            disabled={isBackfilling}
          >
            {isBackfilling
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <History className="h-3.5 w-3.5 text-blue-500" />}
            Backfill 30 ngày
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
            <Link to="/admin/shock-events">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Shock Events{pendingShockCount > 0 ? ` (${pendingShockCount})` : ''}
            </Link>
          </Button>
          <Badge variant="outline" className="gap-1.5 text-green-500 border-green-500/40">
            <Activity className="w-3 h-3" />
            Live
          </Badge>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(prev => !prev)}
          >
            {isFullscreen ? <Eye className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:h-[calc(100vh-180px)] min-w-0">
        {/* Product Sidebar */}
        <div className="w-full md:w-72 md:flex-shrink-0 border rounded-lg bg-card max-h-[40vh] md:max-h-none overflow-hidden min-w-0">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold text-foreground">
              Products ({products.length})
            </h2>
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="p-2 space-y-1">
              {products.map((product) => {
                const price = Number(product.price) || 0;
                const change = Number(product.price_change) || 0;
                const isSelected = effectiveProductId === product.id;

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
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 ml-2 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.symbol || '—'}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground font-mono">
                          ${price.toFixed(2)}
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
        <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-hidden flex flex-col">
          {selectedProduct && effectiveProductId ? (
            <>
              {/* Chart Header */}
              <div className="p-3 border-b">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="text-base font-bold text-foreground">{selectedProduct.name}</h2>
                      <p className="text-xs text-muted-foreground font-mono">{selectedProduct.symbol || '—'}</p>
                    </div>
                    <div className="ml-4">
                      <p className="text-lg font-bold text-foreground font-mono tabular-nums">
                        ${currentPrice.toFixed(2)}
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
                    {chartOHLCData.length > 0 && (
                      <>
                        <ShareButton productId={selectedProduct.id} productName={selectedProduct.name} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Candlestick Chart */}
              <div className="flex-1 p-2 min-h-0">
                <CandlestickChart
                  data={chartOHLCData}
                  height={isFullscreen ? 500 : 380}
                  indicatorConfig={{
                    ma: { enabled: true, period: 20, color: '#3b82f6' },
                    ema: { enabled: true, period: 12, color: '#f59e0b' },
                  }}
                />
              </div>

              {/* Indicators */}
              <div className="px-3 pb-3 space-y-3">
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Manage price shocks in the{' '}
                  <Link to="/admin/shock-events" className="text-primary underline underline-offset-2">
                    Shock Events
                  </Link>{' '}
                  panel. The server-side engine applies them on the next tick.
                </div>
                {technicalIndicators && (
                  <TechnicalIndicatorsPanel indicators={technicalIndicators} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <BarChart3 className="w-12 h-12 opacity-30" />
              <h3 className="text-lg font-medium">Select a Product</h3>
              <p className="text-sm">Choose a product from the sidebar to view its chart</p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : loadingContent;

  return isFullscreen && isReady ? content : <Layout>{content}</Layout>;
}
