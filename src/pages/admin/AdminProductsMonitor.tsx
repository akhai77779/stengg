import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
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
} from 'lucide-react';

import { CandlestickChart, OHLCData } from '@/components/charts/CandlestickChart';
import { TechnicalIndicatorsPanel } from '@/components/charts/TechnicalIndicatorsPanel';
import { TimeIntervalSelector } from '@/components/charts/TimeIntervalSelector';
import { ExportButton } from '@/components/charts/ExportButton';
import { ShareButton } from '@/components/charts/ShareButton';

import {
  generateBase1MCandles,
  aggregateCandles,
  calculateSMA,
  calculateRSI,
  calculateMACD,
} from '@/lib/chartUtils';

import { TimeInterval, Candle, Product, TechnicalIndicators } from '@/types/trading';
import { PRODUCTS } from '@/data/products';

export default function AdminProductsMonitor() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('1M');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [candleData, setCandleData] = useState<Map<string, Candle[]>>(new Map());

  // Load products
  useEffect(() => {
    const chartProducts = PRODUCTS;
    setProducts(chartProducts);
    if (chartProducts.length > 0) {
      const saved = localStorage.getItem('admin_monitor_product');
      setSelectedProductId(saved && chartProducts.find(p => p.id === saved) ? saved : chartProducts[0].id);
    }
    const newCandleData = new Map<string, Candle[]>();
    chartProducts.forEach(product => {
      newCandleData.set(product.id, generateBase1MCandles(product, 1440));
    });
    setCandleData(newCandleData);
    setIsLoading(false);

    const savedTf = localStorage.getItem('admin_monitor_timeframe') as TimeInterval;
    if (savedTf) setTimeInterval(savedTf);
  }, []);

  // Real-time price updates (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setCandleData(prevData => {
        const newData = new Map(prevData);
        products.forEach(product => {
          const candles = newData.get(product.id) || [];
          if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            const newCandle = generateNextCandle(lastCandle, product);
            newData.set(product.id, [...candles.slice(1), newCandle]);
          }
        });
        return newData;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [products]);

  const generateNextCandle = (lastCandle: Candle, product: Product): Candle => {
    const volatility = product.volatility;
    let trendBias = 0;
    if (product.trend === 'bullish') trendBias = 0.6;
    else if (product.trend === 'bearish') trendBias = -0.6;
    else if (product.trend === 'volatile') trendBias = (Math.random() - 0.5) * 2;

    const direction = Math.random() < 0.5 + trendBias * 0.1 ? 1 : -1;
    const change = lastCandle.close * volatility * direction * (0.5 + Math.random() * 0.5);
    const open = lastCandle.close;
    const close = open + change;
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = 1000000 * (0.8 + Math.random() * 0.4) / 1440;

    return { time: lastCandle.time + 60, open, high, low, close, volume };
  };

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // Convert Candle[] to OHLCData[] for the chart component
  const displayCandles = useMemo(() => {
    if (!selectedProductId) return [] as Candle[];
    const baseCandles = candleData.get(selectedProductId) || [];
    if (timeInterval === '1M') return baseCandles;
    return aggregateCandles(baseCandles, timeInterval);
  }, [candleData, selectedProductId, timeInterval]);

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

  const currentPrice = useMemo(() => {
    const candles = candleData.get(selectedProductId || '') || [];
    return candles.length > 0 ? candles[candles.length - 1].close : 0;
  }, [candleData, selectedProductId]);

  const handleProductSelect = useCallback((productId: string) => {
    setSelectedProductId(productId);
    localStorage.setItem('admin_monitor_product', productId);
  }, []);

  const handleTimeframeChange = useCallback((interval: TimeInterval) => {
    setTimeInterval(interval);
    localStorage.setItem('admin_monitor_timeframe', interval);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Activity className="w-8 h-8 animate-pulse text-primary" />
            <p className="text-muted-foreground">Loading products...</p>
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
            Real-time candlestick charts with technical analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-green-500 border-green-500/40">
            <Activity className="w-3 h-3" />
            Live
          </Badge>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={toggleFullscreen}>
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
                const latestCandles = candleData.get(product.id);
                const latestCandle = latestCandles?.[latestCandles.length - 1];
                const price = latestCandle?.close || product.basePrice;
                const change = latestCandle
                  ? ((latestCandle.close - latestCandle.open) / latestCandle.open) * 100
                  : 0;
                const isSelected = selectedProductId === product.id;

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
                      <Activity className="w-4 h-4 text-primary flex-shrink-0" />
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
          {selectedProduct ? (
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

              {/* Technical Indicators */}
              {technicalIndicators && (
                <div className="px-3 pb-3">
                  <TechnicalIndicatorsPanel indicators={technicalIndicators} />
                </div>
              )}
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
