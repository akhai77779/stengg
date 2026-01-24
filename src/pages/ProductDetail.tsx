import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, LineChart as LineIcon, FileText, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Layout } from "@/components/layout/Layout";
import { OptionsTradeSheet } from "@/components/product/OptionsTradeSheet";
import { ActiveOptionTrade } from "@/components/product/ActiveOptionTrade";
import { AnimatedPrice, AnimatedStat } from "@/components/product/AnimatedPrice";
import { MiniPriceChart } from "@/components/product/MiniPriceChart";
import { useAuth } from "@/hooks/useAuth";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useToast } from "@/hooks/use-toast";
import { CandlestickChart, OHLCData } from "@/components/charts/CandlestickChart";
import { ChartIndicators, IndicatorConfig, defaultIndicatorConfig } from "@/components/charts/ChartIndicators";
import { TransactionHistorySheet } from "@/components/product/TransactionHistorySheet";
import { format } from "date-fns";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Simple in-memory cache for candle data
const candleCache = new Map<string, { data: OHLCData[]; timestamp: number; nextCursor: string | null }>();
const CACHE_TTL: Record<string, number> = {
  "1m": 500,   // 500ms for 1m timeframe
  "30m": 5000, // 5s for 30m
  "1h": 10000, // 10s for 1h
  "1d": 30000, // 30s for 1d
};

interface Product {
  id: string;
  name: string;
  symbol?: string | null;
  price: number | null;
  volume: string | null;
  turnover?: string | null;
  price_change: number | null;
  image_url: string | null;
  description: string | null;
  high_24h?: number | null;
  low_24h?: number | null;
}

interface LineChartData {
  time: string;
  price: number;
}

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<LineChartData[]>([]);
  const [candleData, setCandleData] = useState<OHLCData[]>([]);
  const [timeframe, setTimeframe] = useState<"1m" | "30m" | "1h" | "1d">("1h");
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>(defaultIndicatorConfig);
  const [highPrice, setHighPrice] = useState<number | null>(null);
  const [lowPrice, setLowPrice] = useState<number | null>(null);
  const [activePositionCount, setActivePositionCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [candleFlash, setCandleFlash] = useState(false);
  const [realtimeUpdateCount, setRealtimeUpdateCount] = useState(0);
  const lastCandleTimeRef = useRef<string | null>(null);

  // Get latest price from candle data (synced with chart)
  const latestCandlePrice = useMemo(() => {
    if (candleData.length === 0) return null;
    return candleData[candleData.length - 1].close;
  }, [candleData]);

  // Use candle price if available, otherwise fallback to product price
  const displayPrice = latestCandlePrice ?? product?.price ?? null;

  // Fetch active position count
  const fetchActivePositionCount = useCallback(async () => {
    if (!user || !id) return;
    
    const { count, error } = await supabase
      .from("option_trades")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("product_id", id)
      .eq("status", "active");

    if (!error && count !== null) {
      setActivePositionCount(count);
    }
  }, [user, id]);

  // Validate UUID format
  const isValidUUID = (str: string | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Auto-sync external data every 15 seconds (reduced since realtime handles price updates)
  useAutoSync({ 
    enabled: !!user && isValidUUID(id),
    interval: 15000, // Increased from 3s to 15s - realtime handles instant updates
    onSuccess: () => {
      // No need to fetch product - realtime subscription handles it
    }
  });

  useEffect(() => {
    if (isValidUUID(id)) {
      fetchProduct();
    } else if (id) {
      // Invalid ID format
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isValidUUID(id)) {
      fetchPriceHistory(timeframe);
    }
  }, [id, timeframe]);

  // Subscribe to realtime price_history updates (replaces polling)
  useEffect(() => {
    if (!isValidUUID(id)) return;

    setRealtimeStatus('connecting');

    const priceHistoryChannel = supabase
      .channel(`price_history_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_history',
          filter: `product_id=eq.${id}`,
        },
        (payload) => {
          console.log('Realtime candle update:', payload.new);
          const newRecord = payload.new as {
            recorded_at: string;
            open_price: number;
            high_price: number;
            low_price: number;
            close_price: number;
          };

          // Convert to OHLCData format
          const newCandle: OHLCData = {
            time: newRecord.recorded_at,
            open: newRecord.open_price,
            high: newRecord.high_price,
            low: newRecord.low_price,
            close: newRecord.close_price,
          };

          // Trigger flash animation and increment counter
          if (lastCandleTimeRef.current !== newCandle.time) {
            lastCandleTimeRef.current = newCandle.time;
            setCandleFlash(true);
            setRealtimeUpdateCount(prev => prev + 1);
            setTimeout(() => setCandleFlash(false), 600);
          }

          // Merge with existing candles
          setCandleData(prev => {
            if (prev.length === 0) return [newCandle];
            
            const candleMap = new Map(prev.map(c => [c.time, c]));
            candleMap.set(newCandle.time, newCandle);
            
            const merged = Array.from(candleMap.values())
              .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
            
            // Update high/low
            const high = Math.max(...merged.map(c => c.high));
            const low = Math.min(...merged.map(c => c.low));
            setHighPrice(high);
            setLowPrice(low);

            // Update line chart data
            const timeFmt = timeframe === "1m" || timeframe === "30m" ? "HH:mm" : timeframe === "1h" ? "MM/dd HH:mm" : "MM/dd";
            setChartData(merged.map(d => ({
              time: format(new Date(d.time), timeFmt),
              price: Number(d.close),
            })));
            
            return merged;
          });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    // Fallback polling every 5 seconds (reduced from 1s since realtime handles most updates)
    const fallbackInterval = setInterval(() => {
      refreshLatestCandles();
    }, 5000);

    return () => {
      supabase.removeChannel(priceHistoryChannel);
      clearInterval(fallbackInterval);
      setRealtimeStatus('disconnected');
    };
  }, [id, timeframe]);

  // Subscribe to realtime product price updates
  useEffect(() => {
    if (!id || !isValidUUID(id)) return;

    const productChannel = supabase
      .channel(`product_price_${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Realtime price update:', payload.new);
          const newProduct = payload.new as Product;
          setProduct(prev => prev ? { ...prev, ...newProduct } : newProduct);
          
          // Update high/low if available from product
          if (newProduct.high_24h) setHighPrice(newProduct.high_24h);
          if (newProduct.low_24h) setLowPrice(newProduct.low_24h);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productChannel);
    };
  }, [id]);

  // Fetch and subscribe to position count
  useEffect(() => {
    if (!user || !id) return;

    fetchActivePositionCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`option_trades_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'option_trades',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchActivePositionCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, id, fetchActivePositionCount]);

  const fetchProduct = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (data) {
      setProduct(data);
    }
    setLoading(false);
  };

  const fetchPriceHistory = async (tf: "1m" | "30m" | "1h" | "1d") => {
    if (!id) return;
    setPriceHistoryLoading(true);
    setNextCursor(null);

    const { data, error } = await supabase.functions.invoke("ohlc", {
      body: {
        productId: id,
        timeframe: tf,
        limit: 200,
      },
    });

    if (error) {
      console.error("ohlc invoke error", error);
      setCandleData([]);
      setChartData([]);
      setPriceHistoryLoading(false);
      return;
    }

    const candles = (data?.candles ?? []) as OHLCData[];
    setNextCursor((data?.nextCursor as string | undefined) ?? null);
    if (candles.length > 0) {
      setCandleData(candles);

      // Calculate 24h high/low from candle data
      const high = Math.max(...candles.map(c => c.high));
      const low = Math.min(...candles.map(c => c.low));
      setHighPrice(high);
      setLowPrice(low);

      const timeFmt = tf === "1m" || tf === "30m" ? "HH:mm" : tf === "1h" ? "MM/dd HH:mm" : "MM/dd";
      setChartData(
        candles.map((d) => ({
          time: format(new Date(d.time), timeFmt),
          price: Number(d.close),
        })),
      );
    } else {
      setCandleData([]);
      setChartData([]);
      setHighPrice(null);
      setLowPrice(null);
    }
    
    setPriceHistoryLoading(false);
  };

  // Fetch only latest 2 candles and merge with existing data (for real-time updates)
  // Uses cache to reduce API calls
  const lastRefreshRef = useRef<number>(0);
  
  const refreshLatestCandles = async () => {
    if (!id || candleData.length === 0) return;

    // Check cache TTL - skip if recently fetched
    const now = Date.now();
    const ttl = CACHE_TTL[timeframe] || 1000;
    if (now - lastRefreshRef.current < ttl) {
      return; // Skip - too soon since last refresh
    }
    lastRefreshRef.current = now;

    const cacheKey = `refresh_${id}_${timeframe}`;
    const cached = candleCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && (now - cached.timestamp) < ttl) {
      return;
    }

    const { data, error } = await supabase.functions.invoke("ohlc", {
      body: {
        productId: id,
        timeframe,
        limit: 2, // Only fetch last 2 candles (current + previous for accuracy)
      },
    });

    if (error || !data?.candles) return;

    const latestCandles = (data.candles ?? []) as OHLCData[];
    if (latestCandles.length === 0) return;

    // Update cache
    candleCache.set(cacheKey, {
      data: latestCandles,
      timestamp: now,
      nextCursor: null,
    });

    const timeFmt = timeframe === "1m" || timeframe === "30m" ? "HH:mm" : timeframe === "1h" ? "MM/dd HH:mm" : "MM/dd";

    setCandleData((prev) => {
      // Only update/add the latest candles, don't rebuild the entire array
      const map = new Map<string, OHLCData>();
      for (const c of prev) map.set(c.time, c);
      
      let hasChanges = false;
      for (const c of latestCandles) {
        const existing = map.get(c.time);
        // Only update if candle is new or has changed
        if (!existing || existing.close !== c.close || existing.high !== c.high || existing.low !== c.low) {
          map.set(c.time, c);
          hasChanges = true;
        }
      }
      
      // If no changes, return previous state to prevent unnecessary re-renders
      if (!hasChanges) return prev;
      
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      );

      // Update line chart data
      setChartData(
        merged.map((d) => ({
          time: format(new Date(d.time), timeFmt),
          price: Number(d.close),
        })),
      );

      // Update high/low from merged data
      const high = Math.max(...merged.map(c => c.high));
      const low = Math.min(...merged.map(c => c.low));
      setHighPrice(high);
      setLowPrice(low);

      return merged;
    });
  };

  const loadMoreHistory = async () => {
    if (!id || !nextCursor) return;
    setPaging(true);

    const { data, error } = await supabase.functions.invoke("ohlc", {
      body: {
        productId: id,
        timeframe,
        limit: 200,
        cursor: nextCursor,
      },
    });

    if (error) {
      console.error("ohlc paging invoke error", error);
      setPaging(false);
      return;
    }

    const candles = (data?.candles ?? []) as OHLCData[];
    const newCursor = (data?.nextCursor as string | undefined) ?? null;
    setNextCursor(newCursor);

    if (candles.length > 0) {
      const timeFmt = timeframe === "1m" || timeframe === "30m" ? "HH:mm" : timeframe === "1h" ? "MM/dd HH:mm" : "MM/dd";

      setCandleData((prev) => {
        const map = new Map<string, OHLCData>();
        for (const c of [...candles, ...prev]) map.set(c.time, c);
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );

        setChartData(
          merged.map((d) => ({
            time: format(new Date(d.time), timeFmt),
            price: Number(d.close),
          })),
        );

        return merged;
      });
    }

    setPaging(false);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "0";
    if (price >= 1000) {
      return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(4);
  };

  const formatVolume = (volume: string | null) => {
    if (!volume) return "0";
    const num = parseFloat(volume);
    if (isNaN(num)) return volume;
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(2) + "K";
    return volume;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!product) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Không tìm thấy sản phẩm</p>
          <Button onClick={() => navigate("/products")}>Quay lại</Button>
        </div>
      </Layout>
    );
  }

  const isPositive = (product.price_change || 0) >= 0;

  return (
    <Layout hideFooter>
      <div className="space-y-3 pb-24 bg-background min-h-screen">
        {/* Header with back button, product name, mini chart, realtime status and history icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/products")} className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-medium truncate max-w-[120px]">{product.name}</h1>
            {/* Mini sparkline chart */}
            <MiniPriceChart 
              data={candleData.slice(-20).map(c => c.close)} 
              width={50} 
              height={20}
            />
            {/* Price change badge */}
            <span className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{(product.price_change || 0).toFixed(2)}%
            </span>
            {/* Realtime connection status */}
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    {realtimeStatus === 'connected' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
                        <Wifi className="h-3 w-3 text-green-500" />
                      </>
                    ) : realtimeStatus === 'connecting' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        <Wifi className="h-3 w-3 text-yellow-500" />
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <WifiOff className="h-3 w-3 text-red-500" />
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {realtimeStatus === 'connected' && `Realtime: Đang kết nối (${realtimeUpdateCount} updates)`}
                    {realtimeStatus === 'connecting' && 'Realtime: Đang kết nối...'}
                    {realtimeStatus === 'disconnected' && 'Realtime: Mất kết nối'}
                  </p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setHistorySheetOpen(true)}
          >
            <FileText className="h-5 w-5" />
          </Button>
        </div>

        {/* Price Info Section - Top */}
        <div className="flex items-start justify-between px-1">
          <div>
            <AnimatedPrice
              value={displayPrice}
              formatter={formatPrice}
              className="text-2xl font-bold"
            />
            <div className="text-xs text-muted-foreground">
              ≈{formatPrice(displayPrice)}
            </div>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h highest price</span>
              <AnimatedStat value={product.high_24h ? formatPrice(product.high_24h) : (highPrice ? formatPrice(highPrice) : null)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h lowest price</span>
              <AnimatedStat value={product.low_24h ? formatPrice(product.low_24h) : (lowPrice ? formatPrice(lowPrice) : null)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h trading volume</span>
              <AnimatedStat value={formatVolume(product.volume)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h turnover</span>
              <AnimatedStat value={formatVolume(product.turnover || product.volume)} className="font-medium" />
            </div>
          </div>
        </div>

        {/* Chart Type and Timeframe Controls */}
        <div className="flex items-center gap-2 px-1">
          <Button
            variant={chartType === 'line' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setChartType('line')}
            className="h-7 px-2 text-xs"
          >
            Line
          </Button>
          {(["1m", "5m", "15m", "30m", "1h", "1d"] as const).map((tf) => {
            const mappedTf = tf === "5m" || tf === "15m" ? "1m" : tf as "1m" | "30m" | "1h" | "1d";
            const displayLabel = tf === "1m" ? "1M" : tf === "5m" ? "5M" : tf === "15m" ? "15M" : tf === "30m" ? "30M" : tf === "1h" ? "1H" : "1D";
            return (
              <Button
                key={tf}
                variant={timeframe === mappedTf && chartType === 'candle' && (tf === "1m" || tf === "30m" || tf === "1h" || tf === "1d") ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setChartType('candle');
                  setTimeframe(mappedTf);
                }}
                className="h-7 px-2 text-xs"
              >
                {displayLabel}
              </Button>
            );
          })}
          
          {/* Indicators button */}
          {chartType === 'candle' && (
            <div className="ml-auto">
              <ChartIndicators
                config={indicatorConfig}
                onChange={setIndicatorConfig}
              />
            </div>
          )}
        </div>

        {/* MA Indicators Display */}
        {chartType === 'candle' && (indicatorConfig.ma.enabled || indicatorConfig.ema.enabled) && (
          <div className="flex gap-4 text-xs px-1">
            {indicatorConfig.ma.enabled && (
              <span style={{ color: indicatorConfig.ma.color }}>
                MA{indicatorConfig.ma.period}: {candleData.length > 0 ? formatPrice(candleData[candleData.length - 1]?.close) : "--"}
              </span>
            )}
            {indicatorConfig.ema.enabled && (
              <span style={{ color: indicatorConfig.ema.color }}>
                MA{indicatorConfig.ema.period}: {candleData.length > 0 ? formatPrice(candleData[candleData.length - 1]?.close) : "--"}
              </span>
            )}
          </div>
        )}

        {/* Chart */}
        <Card className={`bg-card border-border transition-shadow duration-300 ${candleFlash ? 'animate-candle-flash' : ''}`}>
          <CardContent className="p-2">
            <div className="h-64">
              {priceHistoryLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : chartType === 'candle' ? (
                <CandlestickChart data={candleData} height={256} indicatorConfig={indicatorConfig} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      hide 
                      domain={['dataMin - 100', 'dataMax + 100']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>


        {/* Position Section */}
        <div className="px-1">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">Position({activePositionCount})</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => setHistorySheetOpen(true)}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Active Option Trade Display */}
          {user && product && (
            <div className="mt-3">
              <ActiveOptionTrade 
                productId={product.id} 
                currentPrice={product.price}
                onSettled={() => {
                  fetchProduct();
                  fetchActivePositionCount();
                }}
              />
            </div>
          )}
          
          {/* Empty state when no positions */}
          {activePositionCount === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chưa có vị thế nào
            </div>
          )}
        </div>

        {/* Buy Up / Buy Down Buttons */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border/50">
          <div className="max-w-md mx-auto flex gap-3">
            <Button 
              className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white text-base font-semibold rounded-lg"
              onClick={() => {
                if (!user) {
                  toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
                  navigate('/login');
                  return;
                }
                setOptionsSheetOpen(true);
              }}
            >
              Buy Up
            </Button>
            <Button 
              className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white text-base font-semibold rounded-lg"
              onClick={() => {
                if (!user) {
                  toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
                  navigate('/login');
                  return;
                }
                setOptionsSheetOpen(true);
              }}
            >
              Buy Down
            </Button>
          </div>
        </div>

        {/* Options Trade Sheet */}
        {product && (
          <OptionsTradeSheet
            isOpen={optionsSheetOpen}
            onClose={() => setOptionsSheetOpen(false)}
            product={{
              id: product.id,
              name: product.name,
              symbol: product.symbol,
              price: product.price,
            }}
            onSuccess={fetchProduct}
          />
        )}

        {/* Transaction History Sheet */}
        <TransactionHistorySheet 
          isOpen={historySheetOpen}
          onClose={() => setHistorySheetOpen(false)}
          productId={product.id}
        />
      </div>
    </Layout>
  );
};

export default ProductDetail;
