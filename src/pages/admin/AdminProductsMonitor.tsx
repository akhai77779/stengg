import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CandlestickChart, OHLCData, CandlestickChartRef } from '@/components/charts/CandlestickChart';
import { TrendingUp, TrendingDown, Activity, RefreshCw, ExternalLink, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type Timeframe = '1m' | '5m' | '15m' | '1h';

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
];

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
  isLoading: boolean;
}

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

function ProductChartCard({
  product,
  colorClass,
}: {
  product: ProductWithChart;
  colorClass: string;
}) {
  const chartRef = useRef<CandlestickChartRef>(null);
  const isPositive = (product.price_change || 0) >= 0;

  return (
    <Card
      className={cn(
        'relative overflow-hidden border bg-gradient-to-br transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5',
        colorClass
      )}
    >
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
            <span className="text-base font-bold text-foreground font-mono tabular-nums">{formatPrice(product.price)}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs px-1.5 py-0 h-5 font-mono font-medium border',
                isPositive ? 'bg-green-500/15 text-green-400 border-green-500/40' : 'bg-red-500/15 text-red-400 border-red-500/40'
              )}
            >
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {formatChange(product.price_change)}%
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

  // Fetch OHLC from external API via ohlc edge function
  const fetchOHLC = useCallback(async (productId: string, tf: Timeframe): Promise<OHLCData[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('ohlc', {
        body: { productId, timeframe: tf, limit: 100 },
      });

      if (error || !data?.candles) {
        console.warn(`[Monitor] ohlc fetch failed for ${productId}:`, error?.message);
        return [];
      }

      return (data.candles as OHLCData[]).filter(
        (c) => c.open > 0 || c.close > 0
      );
    } catch (err) {
      console.warn(`[Monitor] ohlc error for ${productId}:`, err);
      return [];
    }
  }, []);

  // Load top 10 products
  const loadProducts = useCallback(async (tf: Timeframe) => {
    setIsLoadingList(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, symbol, price, price_change, high_24h, low_24h, volume, category, image_url')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) { setIsLoadingList(false); return; }

    setProducts(data.map(p => ({ ...p, ohlcData: [], isLoading: true })));
    setIsLoadingList(false);

    // Fetch OHLC for all products in parallel
    const ohlcResults = await Promise.all(data.map(p => fetchOHLC(p.id, tf)));
    setProducts(data.map((p, i) => ({ ...p, ohlcData: ohlcResults[i], isLoading: false })));
    setLastUpdated(new Date());
  }, [fetchOHLC]);

  useEffect(() => {
    loadProducts(timeframe);
  }, [loadProducts, timeframe]);

  // Handle timeframe change: mark charts as loading, then reload
  const handleTimeframeChange = useCallback(async (tf: Timeframe) => {
    if (tf === timeframe) return;
    setIsChangingTimeframe(true);
    setProducts(prev => prev.map(p => ({ ...p, ohlcData: [], isLoading: true })));
    setTimeframe(tf);
    // loadProducts will run via useEffect
    setTimeout(() => setIsChangingTimeframe(false), 500);
  }, [timeframe]);

  // Realtime: product price updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-monitor-products')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...(payload.new as Product) } : p));
        setLastUpdated(new Date());
      })
      .subscribe((status) => setRealtimeConnected(status === 'SUBSCRIBED'));
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime: product price updates — reload chart data when product prices change
  useEffect(() => {
    const channel = supabase
      .channel('admin-monitor-price-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history' }, async (payload) => {
        const newRow = payload.new as { product_id: string };
        if (!newRow?.product_id) return;
        // Re-fetch only the affected product's candles from external API
        const candles = await fetchOHLC(newRow.product_id, timeframe);
        setProducts(prev => prev.map(p =>
          p.id === newRow.product_id ? { ...p, ohlcData: candles } : p
        ));
        setLastUpdated(new Date());
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [timeframe, fetchOHLC]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gradient">Market Monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Biểu đồ nến live của 10 sản phẩm — dữ liệu realtime
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe selector */}
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

          {/* Realtime indicator */}
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

          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {lastUpdated.toLocaleTimeString('vi-VN')}
            </span>
          )}

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
        </div>
      </div>

      {/* Summary Stats Bar */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sản phẩm', value: products.length, suffix: '/10', color: 'text-primary' },
            { label: 'Tăng', value: products.filter(p => (p.price_change || 0) >= 0).length, suffix: '', color: 'text-green-400' },
            { label: 'Giảm', value: products.filter(p => (p.price_change || 0) < 0).length, suffix: '', color: 'text-red-400' },
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
            <ProductChartCard key={product.id} product={product} colorClass={COLORS[index % COLORS.length]} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
        Khung thời gian: <span className="font-semibold text-foreground">{timeframe}</span> —{' '}
        dữ liệu từ <code className="bg-muted px-1 rounded">ohlc</code> edge function (external API)
      </p>
    </div>
  );
}
