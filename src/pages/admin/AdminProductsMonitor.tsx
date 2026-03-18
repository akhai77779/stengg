import { useState, useMemo, useCallback } from 'react';
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
  RotateCcw,
  CloudUpload,
} from 'lucide-react';

import { CandlestickChart, OHLCData } from '@/components/charts/CandlestickChart';
import { TechnicalIndicatorsPanel } from '@/components/charts/TechnicalIndicatorsPanel';
import { TimeIntervalSelector } from '@/components/charts/TimeIntervalSelector';
import { ExportButton } from '@/components/charts/ExportButton';
import { ShareButton } from '@/components/charts/ShareButton';
import { ShockEventPanel } from '@/components/admin/ShockEventPanel';
import { SnapshotManager } from '@/components/admin/SnapshotManager';

import { aggregateCandles, calculateSMA, calculateRSI, calculateMACD } from '@/lib/chartUtils';
import { TimeInterval, TechnicalIndicators } from '@/types/trading';
import { useMarketEngine } from '@/hooks/useMarketEngine';
import { useEngineSyncToDb } from '@/hooks/useEngineSyncToDb';

export default function AdminProductsMonitor() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    return localStorage.getItem('admin_monitor_product') || null;
  });
  const [timeInterval, setTimeInterval] = useState<TimeInterval>(() => {
    return (localStorage.getItem('admin_monitor_timeframe') as TimeInterval) || '1M';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dbSyncEnabled, setDbSyncEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem('admin_db_sync_enabled');
    // Default to true if never explicitly set
    return stored === null ? true : stored === 'true';
  });

  const {
    products,
    engines,
    isReady,
    getCandles,
    getCurrentPrice,
    getActiveShock,
    scenarios,
    addShockEvent,
    cancelShockEvent,
    updateScenario,
    shockEvents,
    resetEngine,
    namedSnapshots,
    saveNewSnapshot,
    restoreSnapshot,
    removeSnapshot,
    renameSnapshot,
  } = useMarketEngine();

  // Sync engine data to DB for user-facing charts
  const { mappings: syncMappings, isSyncing, stats: syncStats } = useEngineSyncToDb(
    engines,
    dbSyncEnabled,
    3000
  );

  const toggleDbSync = useCallback(() => {
    setDbSyncEnabled(prev => {
      const next = !prev;
      localStorage.setItem('admin_db_sync_enabled', String(next));
      return next;
    });
  }, []);

  // Auto-select first product
  const effectiveProductId = useMemo(() => {
    if (selectedProductId && products.find(p => p.id === selectedProductId)) {
      return selectedProductId;
    }
    return products.length > 0 ? products[0].id : null;
  }, [selectedProductId, products]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === effectiveProductId) || null;
  }, [products, effectiveProductId]);

  const displayCandles = useMemo(() => {
    if (!effectiveProductId) return [];
    const baseCandles = getCandles(effectiveProductId);
    if (timeInterval === '1M') return baseCandles;
    return aggregateCandles(baseCandles, timeInterval);
  }, [getCandles, effectiveProductId, timeInterval]);

  const chartOHLCData: OHLCData[] = useMemo(() => {
    return displayCandles.map(c => ({
      time: new Date(c.time * 1000).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }, [displayCandles]);

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

  const currentPrice = effectiveProductId ? getCurrentPrice(effectiveProductId) : 0;
  const activeShock = effectiveProductId ? getActiveShock(effectiveProductId) : null;
  const activeShockCount = shockEvents.filter(e => !e.isComplete).length;

  const handleProductSelect = useCallback((productId: string) => {
    setSelectedProductId(productId);
    localStorage.setItem('admin_monitor_product', productId);
  }, []);

  const handleTimeframeChange = useCallback((interval: TimeInterval) => {
    setTimeInterval(interval);
    localStorage.setItem('admin_monitor_timeframe', interval);
  }, []);

  if (!isReady) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Activity className="w-8 h-8 animate-pulse text-primary" />
            <p className="text-muted-foreground">Loading market engine...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const content = (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Product Chart Monitor</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            4-layer engine: Scenario → Engine → Persistence → Shock Events
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* DB Sync Toggle */}
          <Button
            size="sm"
            variant={dbSyncEnabled ? "default" : "outline"}
            className={`h-8 gap-1.5 ${dbSyncEnabled ? '' : 'text-muted-foreground'}`}
            onClick={toggleDbSync}
          >
            <CloudUpload className={`h-3.5 w-3.5 ${isSyncing ? 'animate-pulse' : ''}`} />
            {dbSyncEnabled ? `Sync ON (${syncMappings.length})` : 'DB Sync'}
          </Button>
          {dbSyncEnabled && syncStats.lastSyncAt && (
            <Badge variant="outline" className="gap-1 text-xs">
              {syncStats.candlesSynced} candles · {syncStats.pricesUpdated} prices
            </Badge>
          )}
          {activeShockCount > 0 && (
            <Badge variant="outline" className="gap-1.5 text-amber-500 border-amber-500/40">
              <Zap className="w-3 h-3" />
              {activeShockCount} shock{activeShockCount > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="outline" className="gap-1.5 text-green-500 border-green-500/40">
            <Activity className="w-3 h-3" />
            Live
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => {
              if (confirm('Reset toàn bộ market engine? Dữ liệu chart sẽ được tạo mới.')) {
                resetEngine();
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
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
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Product Sidebar */}
        <div className="w-72 flex-shrink-0 border rounded-lg bg-card">
          <div className="p-3 border-b">
            <h2 className="text-sm font-semibold text-foreground">
              Products ({products.length})
            </h2>
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            <div className="p-2 space-y-1">
              {products.map((product) => {
                const price = getCurrentPrice(product.id) || product.basePrice;
                const candles = getCandles(product.id);
                const lastCandle = candles[candles.length - 1];
                const change = lastCandle
                  ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100
                  : 0;
                const isSelected = effectiveProductId === product.id;
                const hasShock = !!getActiveShock(product.id);

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
                        {hasShock && <Zap className="w-3 h-3 text-amber-500 animate-pulse" />}
                      </div>
                      <div className="flex-1 ml-2 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{product.symbol}</p>
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
        <div className="flex-1 border rounded-lg bg-card overflow-hidden flex flex-col">
          {selectedProduct && effectiveProductId ? (
            <>
              {/* Chart Header */}
              <div className="p-3 border-b">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="text-base font-bold text-foreground">{selectedProduct.name}</h2>
                      <p className="text-xs text-muted-foreground font-mono">{selectedProduct.symbol}</p>
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
                <CandlestickChart
                  data={chartOHLCData}
                  height={isFullscreen ? 500 : 380}
                  indicatorConfig={{
                    ma: { enabled: true, period: 20, color: '#3b82f6' },
                    ema: { enabled: true, period: 12, color: '#f59e0b' },
                  }}
                />
              </div>

              {/* Shock Event + Indicators */}
              <div className="px-3 pb-3 space-y-3">
                <ShockEventPanel
                  productId={effectiveProductId}
                  productName={selectedProduct.name}
                  currentPrice={currentPrice}
                  activeShock={activeShock}
                  scenario={scenarios[effectiveProductId] || null}
                  onAddShock={addShockEvent}
                  onCancelShock={cancelShockEvent}
                  onUpdateScenario={updateScenario}
                />
                <SnapshotManager
                  namedSnapshots={namedSnapshots}
                  onSave={saveNewSnapshot}
                  onRestore={restoreSnapshot}
                  onDelete={removeSnapshot}
                  onRename={renameSnapshot}
                />
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
  );

  return isFullscreen ? content : <Layout>{content}</Layout>;
}
