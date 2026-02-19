import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CandlestickChart, OHLCData, CandlestickChartRef } from '@/components/charts/CandlestickChart';
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, ExternalLink,
  WifiOff, Database, Image, Zap, Minus, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useLivePriceSync } from '@/hooks/useLivePriceSync';

type Timeframe = '1m' | '5m' | '15m' | '1h';
type TrendDirection = 'bull' | 'bear' | 'neutral';

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

type DataSource = 'live' | 'db_cache' | 'none';

interface PriceControl {
  direction: TrendDirection;
  strength: number;
}

interface ProductWithChart extends Product {
  ohlcData: OHLCData[];
  isLoading: boolean;
  dataSource: DataSource;
  priceControl: PriceControl;
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

function DataSourceBadge({ source }: { source: DataSource }) {
  if (source === 'live') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
      Live API
    </span>
  );
  if (source === 'db_cache') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      DB Cache
    </span>
  );
  return null;
}

/** Pill button for direction selection */
function DirectionPill({
  value,
  current,
  onClick,
}: {
  value: TrendDirection;
  current: TrendDirection;
  onClick: () => void;
}) {
  const config: Record<TrendDirection, { label: string; icon: React.ReactNode; active: string; inactive: string }> = {
    bull: {
      label: 'Bull',
      icon: <TrendingUp className="w-3 h-3" />,
      active: 'bg-green-500/20 text-green-400 border-green-500/50',
      inactive: 'text-muted-foreground border-border hover:border-green-500/30 hover:text-green-400',
    },
    neutral: {
      label: 'Neutral',
      icon: <Minus className="w-3 h-3" />,
      active: 'bg-primary/15 text-primary border-primary/40',
      inactive: 'text-muted-foreground border-border hover:border-primary/30 hover:text-primary',
    },
    bear: {
      label: 'Bear',
      icon: <TrendingDown className="w-3 h-3" />,
      active: 'bg-red-500/20 text-red-400 border-red-500/50',
      inactive: 'text-muted-foreground border-border hover:border-red-500/30 hover:text-red-400',
    },
  };
  const c = config[value];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border transition-all duration-150',
        current === value ? c.active : c.inactive,
      )}
    >
      {c.icon}
      {c.label}
    </button>
  );
}

function ProductChartCard({
  product,
  colorClass,
  onControlChange,
}: {
  product: ProductWithChart;
  colorClass: string;
  onControlChange: (id: string, control: PriceControl) => void;
}) {
  const chartRef = useRef<CandlestickChartRef>(null);
  const isPositive = (product.price_change || 0) >= 0;
  const ctrl = product.priceControl;
  const [isSaving, setIsSaving] = useState(false);

  // Local state for slider — only persist on release
  const [localStrength, setLocalStrength] = useState(ctrl.strength);

  // Keep in sync when parent updates
  useEffect(() => { setLocalStrength(ctrl.strength); }, [ctrl.strength]);

  const handleDirectionChange = async (dir: TrendDirection) => {
    onControlChange(product.id, { ...ctrl, direction: dir });
    await persistControl(product.id, dir, ctrl.strength);
  };

  const handleStrengthCommit = async (val: number[]) => {
    const strength = val[0];
    onControlChange(product.id, { ...ctrl, strength });
    await persistControl(product.id, ctrl.direction, strength);
  };

  const persistControl = async (productId: string, direction: TrendDirection, strength: number) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('product_price_controls')
        .upsert({ product_id: productId, direction, strength, updated_at: new Date().toISOString() }, {
          onConflict: 'product_id',
        });
      if (error) toast.error('Lưu thất bại: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden border bg-gradient-to-br transition-all duration-300 hover:shadow-lg hover:shadow-primary/10',
        colorClass,
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
            <div className="flex items-center gap-2 mt-0.5">
              {product.symbol && <span className="text-xs text-muted-foreground font-mono">{product.symbol}</span>}
              {!product.isLoading && <DataSourceBadge source={product.dataSource} />}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-base font-bold text-foreground font-mono tabular-nums">{formatPrice(product.price)}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs px-1.5 py-0 h-5 font-mono font-medium border',
                isPositive ? 'bg-green-500/15 text-green-400 border-green-500/40' : 'bg-red-500/15 text-red-400 border-red-500/40',
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
      <CardContent className="px-2 pb-2 pt-0">
        {product.isLoading ? (
          <div className="h-[140px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-xs">Đang tải...</span>
            </div>
          </div>
        ) : product.ohlcData.length === 0 ? (
          <div className="h-[140px] flex items-center justify-center text-muted-foreground text-xs">
            Chưa có dữ liệu OHLC
          </div>
        ) : (
          <CandlestickChart
            ref={chartRef}
            data={product.ohlcData}
            height={140}
            indicatorConfig={{ ma: { enabled: false, period: 7, color: '#f59e0b' }, ema: { enabled: false, period: 25, color: '#8b5cf6' } }}
          />
        )}
      </CardContent>

      {/* ── Price Control Panel ── */}
      <div className="mx-3 mb-3 px-3 py-2.5 rounded-lg bg-background/60 border border-border/60 space-y-2">
        {/* Direction */}
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trend</span>
          <div className="flex items-center gap-1">
            {(['bull', 'neutral', 'bear'] as TrendDirection[]).map(dir => (
              <DirectionPill
                key={dir}
                value={dir}
                current={ctrl.direction}
                onClick={() => handleDirectionChange(dir)}
              />
            ))}
            {isSaving && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
          </div>
        </div>

        {/* Volatility Strength */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            Volatility
          </span>
          <div className="flex-1">
            <Slider
              min={0.1}
              max={5}
              step={0.1}
              value={[localStrength]}
              onValueChange={(v) => setLocalStrength(v[0])}
              onValueCommit={handleStrengthCommit}
              className="h-3"
            />
          </div>
          <span className={cn(
            'text-[11px] font-mono font-bold w-7 text-right',
            localStrength > 3 ? 'text-red-400' : localStrength > 1.5 ? 'text-amber-400' : 'text-muted-foreground',
          )}>
            {localStrength.toFixed(1)}x
          </span>
        </div>
      </div>

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingImages, setIsSyncingImages] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // Auto-sync live price every 5 seconds
  const { isSyncing: isLiveSyncing, lastSyncAt: liveSyncAt } = useLivePriceSync({
    enabled: autoSyncEnabled,
    interval: 5000,
  });

  const fetchOHLC = useCallback(async (productId: string, tf: Timeframe): Promise<{ candles: OHLCData[]; source: DataSource }> => {
    try {
      const { data, error } = await supabase.functions.invoke('ohlc', {
        body: { productId, timeframe: tf, limit: 100 },
      });
      if (error || !data?.candles) return { candles: [], source: 'none' };
      const candles = (data.candles as OHLCData[]).filter(c => c.open > 0 || c.close > 0);
      const source: DataSource = data.source === 'db_fallback' ? 'db_cache' : 'live';
      return { candles, source };
    } catch {
      return { candles: [], source: 'none' };
    }
  }, []);

  const loadProducts = useCallback(async (tf: Timeframe) => {
    setIsLoadingList(true);
    const [productsRes, controlsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, symbol, price, price_change, high_24h, low_24h, volume, category, image_url')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('product_price_controls')
        .select('product_id, direction, strength'),
    ]);

    if (productsRes.error || !productsRes.data) { setIsLoadingList(false); return; }

    const controlMap = new Map<string, PriceControl>();
    for (const c of controlsRes.data ?? []) {
      controlMap.set(c.product_id, {
        direction: (c.direction ?? 'neutral') as TrendDirection,
        strength: typeof c.strength === 'number' ? c.strength : 1,
      });
    }

    const defaultControl: PriceControl = { direction: 'neutral', strength: 1 };
    setProducts(productsRes.data.map(p => ({
      ...p,
      ohlcData: [],
      isLoading: true,
      dataSource: 'none' as DataSource,
      priceControl: controlMap.get(p.id) ?? defaultControl,
    })));
    setIsLoadingList(false);

    const ohlcResults = await Promise.all(productsRes.data.map(p => fetchOHLC(p.id, tf)));
    setProducts(productsRes.data.map((p, i) => ({
      ...p,
      ohlcData: ohlcResults[i].candles,
      isLoading: false,
      dataSource: ohlcResults[i].source,
      priceControl: controlMap.get(p.id) ?? defaultControl,
    })));
    setLastUpdated(new Date());
  }, [fetchOHLC]);

  useEffect(() => { loadProducts(timeframe); }, [loadProducts, timeframe]);

  /** Called by card when direction/strength changes — update local state only */
  const handleControlChange = useCallback((id: string, control: PriceControl) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, priceControl: control } : p));
  }, []);

  const [isResetting, setIsResetting] = useState(false);
  /** Reset ALL products to neutral direction, strength 1x */
  const resetAllControls = useCallback(async () => {
    setIsResetting(true);
    const toastId = toast.loading('Đang reset tất cả về Neutral...');
    try {
      const productIds = products.map(p => p.id);
      if (productIds.length === 0) {
        toast.info('Không có sản phẩm nào để reset', { id: toastId });
        return;
      }
      const rows = productIds.map(id => ({
        product_id: id,
        direction: 'neutral' as TrendDirection,
        strength: 1,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('product_price_controls')
        .upsert(rows, { onConflict: 'product_id' });
      if (error) {
        toast.error('Reset thất bại: ' + error.message, { id: toastId });
        return;
      }
      // Update local state
      setProducts(prev => prev.map(p => ({ ...p, priceControl: { direction: 'neutral', strength: 1 } })));
      toast.success(`Đã reset ${productIds.length} sản phẩm về Neutral 1x`, { id: toastId });
    } catch (err) {
      toast.error('Lỗi: ' + (err instanceof Error ? err.message : 'Unknown'), { id: toastId });
    } finally {
      setIsResetting(false);
    }
  }, [products]);

  const syncPriceHistory = useCallback(async () => {
    setIsSyncing(true);
    const toastId = toast.loading('Đang đồng bộ dữ liệu giá...');
    try {
      const { data, error } = await supabase.functions.invoke('sync-price-history', { body: {} });
      if (error) { toast.error('Đồng bộ thất bại: ' + error.message, { id: toastId }); return; }
      const stats = data?.stats;
      toast.success(`Đồng bộ thành công! ${stats?.products?.synced ?? 0} sản phẩm, ${stats?.records?.inserted ?? 0} bản ghi mới`, { id: toastId });
      await loadProducts(timeframe);
    } catch (err) {
      toast.error('Lỗi đồng bộ: ' + (err instanceof Error ? err.message : 'Unknown'), { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  }, [loadProducts, timeframe]);

  const syncProductImages = useCallback(async () => {
    setIsSyncingImages(true);
    const toastId = toast.loading('Đang tải ảnh sản phẩm...');
    try {
      const { data, error } = await supabase.functions.invoke('sync-product-images', { body: {} });
      if (error) { toast.error('Lỗi tải ảnh: ' + error.message, { id: toastId }); return; }
      const stats = data?.stats;
      toast.success(`Ảnh đồng bộ xong! ${stats?.synced ?? 0} ảnh mới, ${stats?.alreadyLocal ?? 0} đã có`, { id: toastId });
      await loadProducts(timeframe);
    } catch (err) {
      toast.error('Lỗi: ' + (err instanceof Error ? err.message : 'Unknown'), { id: toastId });
    } finally {
      setIsSyncingImages(false);
    }
  }, [loadProducts, timeframe]);

  const handleTimeframeChange = useCallback(async (tf: Timeframe) => {
    if (tf === timeframe) return;
    setIsChangingTimeframe(true);
    setProducts(prev => prev.map(p => ({ ...p, ohlcData: [], isLoading: true })));
    setTimeframe(tf);
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

  // Realtime: price history updates → reload chart candles
  useEffect(() => {
    const channel = supabase
      .channel('admin-monitor-price-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history' }, async (payload) => {
        const newRow = payload.new as { product_id: string };
        if (!newRow?.product_id) return;
        const result = await fetchOHLC(newRow.product_id, timeframe);
        setProducts(prev => prev.map(p =>
          p.id === newRow.product_id ? { ...p, ohlcData: result.candles, dataSource: result.source } : p,
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
            Biểu đồ nến live — điều chỉnh trend & volatility cho từng sản phẩm
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe */}
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
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
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

          {/* Auto sync toggle */}
          <button
            onClick={() => setAutoSyncEnabled(v => !v)}
            title={autoSyncEnabled ? 'Tắt auto-sync giá live (đang bật, mỗi 5s)' : 'Bật auto-sync giá live mỗi 5s'}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md border transition-all duration-200',
              autoSyncEnabled
                ? 'bg-primary/10 text-primary border-primary/40 hover:bg-primary/20'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
            )}
          >
            <Zap className={cn('w-3 h-3', autoSyncEnabled && isLiveSyncing && 'animate-pulse')} />
            {autoSyncEnabled ? 'Auto' : 'Manual'}
          </button>

          {liveSyncAt && autoSyncEnabled && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {liveSyncAt.toLocaleTimeString('vi-VN')}
            </span>
          )}

          <Button
            size="sm"
            variant="default"
            onClick={syncPriceHistory}
            disabled={isSyncing || isLoadingList || isSyncingImages || isResetting}
            className="gap-2 h-8"
          >
            <Database className={cn('w-3.5 h-3.5', isSyncing && 'animate-pulse')} />
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={syncProductImages}
            disabled={isSyncingImages || isLoadingList || isSyncing}
            className="gap-2 h-8"
          >
            <Image className={cn('w-3.5 h-3.5', isSyncingImages && 'animate-pulse')} />
            {isSyncingImages ? 'Đang tải ảnh...' : 'Đồng bộ ảnh'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={resetAllControls}
            disabled={isResetting || isLoadingList}
            className="gap-2 h-8 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
            title="Reset tất cả sản phẩm về Neutral, strength 1x"
          >
            <RotateCcw className={cn('w-3.5 h-3.5', isResetting && 'animate-spin')} />
            {isResetting ? 'Đang reset...' : 'Reset All'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => loadProducts(timeframe)}
            disabled={isLoadingList || isChangingTimeframe || isSyncing || isSyncingImages}
            className="gap-2 h-8"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', (isLoadingList || isChangingTimeframe) && 'animate-spin')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sản phẩm', value: products.length, suffix: '/10', color: 'text-primary' },
            { label: 'Tăng', value: products.filter(p => (p.price_change || 0) >= 0).length, suffix: '', color: 'text-green-400' },
            { label: 'Giảm', value: products.filter(p => (p.price_change || 0) < 0).length, suffix: '', color: 'text-red-400' },
            { label: 'Bull mode', value: products.filter(p => p.priceControl.direction === 'bull').length, suffix: '', color: 'text-emerald-400' },
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
                <div className="h-[140px] bg-muted rounded" />
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
              onControlChange={handleControlChange}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50">
        Trend & Volatility ảnh hưởng đến giá sinh tự động mỗi 5 giây — cài đặt được lưu ngay lập tức
      </p>
    </div>
  );
}
