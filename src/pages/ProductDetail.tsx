import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { CandlestickChart, OHLCData } from "@/components/charts/CandlestickChart";
import { ChartIndicators, IndicatorConfig, defaultIndicatorConfig } from "@/components/charts/ChartIndicators";
import { TransactionHistorySheet } from "@/components/product/TransactionHistorySheet";
import { CandleCountdown } from "@/components/charts/CandleCountdown";
import { RealtimeStatusIndicator } from "@/components/charts/RealtimeStatusIndicator";
import { useProductRealtime, useUserTradesRealtime, ConnectionStatus } from "@/hooks/useProductRealtime";
import { format } from "date-fns";

// Simple in-memory cache for candle data
const candleCache = new Map<string, { data: OHLCData[]; timestamp: number; nextCursor: string | null }>();
const CACHE_TTL: Record<string, number> = {
  "1m": 500,   // 500ms for 1m timeframe
  "5m": 2000,  // 2s for 5m
  "15m": 4000, // 4s for 15m
  "30m": 5000, // 5s for 30m
  "1h": 10000, // 10s for 1h
  "1d": 30000, // 30s for 1d
};

// Throttle intervals based on timeframe (faster timeframes need faster updates)
const THROTTLE_MS: Record<string, number> = {
  "1m": 100,   // 100ms for 1m
  "5m": 200,   // 200ms for 5m
  "15m": 300,  // 300ms for 15m
  "30m": 500,  // 500ms for 30m
  "1h": 500,   // 500ms for 1h
  "1d": 1000,  // 1s for 1d
};

// Manual slug mapping for products where auto-generated slug doesn't match external chart tool
const PRODUCT_SLUG_MAP: Record<string, string> = {
  'Communications-on-the-Move': 'comm-move',
};

// All products now use local CandlestickChart (external embed service is no longer available)
const USE_LOCAL_CHART = true;

// Generate embed slug from product name
const generateProductSlug = (name: string): string => {
  if (PRODUCT_SLUG_MAP[name]) return PRODUCT_SLUG_MAP[name];
  
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const EMBED_BASE_URL = "https://preview-fdn8qxbfr8qo.devv.app/embed";

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

// Memoized chart wrapper to prevent unnecessary re-renders
const MemoizedCandlestickChart = memo(CandlestickChart);
const MemoizedMiniPriceChart = memo(MiniPriceChart);

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<LineChartData[]>([]);
  const [candleData, setCandleData] = useState<OHLCData[]>([]);
  const [timeframe, setTimeframe] = useState<"1m" | "5m" | "15m" | "30m" | "1h" | "1d">(() => {
    const saved = localStorage.getItem('chart_timeframe');
    const validTimeframes = ["1m", "5m", "15m", "30m", "1h", "1d"];
    return saved && validTimeframes.includes(saved) ? saved as "1m" | "5m" | "15m" | "30m" | "1h" | "1d" : "30m";
  });

  // Persist timeframe to localStorage
  useEffect(() => {
    localStorage.setItem('chart_timeframe', timeframe);
  }, [timeframe]);
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const [indicatorConfig, setIndicatorConfig] = useState<IndicatorConfig>(defaultIndicatorConfig);
  const [highPrice, setHighPrice] = useState<number | null>(null);
  const [lowPrice, setLowPrice] = useState<number | null>(null);
  const [activePositionCount, setActivePositionCount] = useState(0);
  const [candleFlash, setCandleFlash] = useState(false);
  const lastCandleTimeRef = useRef<string | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get latest price from candle data (synced with chart)
  const latestCandlePrice = useMemo(() => {
    if (candleData.length === 0) return null;
    return candleData[candleData.length - 1].close;
  }, [candleData]);

  // Use candle price if available, otherwise fallback to product price
  const displayPrice = latestCandlePrice ?? product?.price ?? null;

  // Validate UUID format
  const isValidUUID = useCallback((str: string | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }, []);

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

  // Handle candle updates from realtime - memoized to prevent hook re-subscription
  const handleCandleUpdate = useCallback((newCandle: OHLCData) => {
    const timeFmt = timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "30m" ? "HH:mm" : timeframe === "1h" ? "MM/dd HH:mm" : "MM/dd";

    if (timeframe !== "1m") {
      const secondsMap: Record<string, number> = {
        "5m": 300,
        "15m": 900,
        "30m": 1800,
        "1h": 3600,
        "1d": 86400,
      };
      const bucketSize = secondsMap[timeframe] || 1800;
      const tsSec = Math.floor(new Date(newCandle.time).getTime() / 1000);
      const bucketTime = new Date(Math.floor(tsSec / bucketSize) * bucketSize * 1000).toISOString();

      if (lastCandleTimeRef.current !== bucketTime) {
        lastCandleTimeRef.current = bucketTime;
        setCandleFlash(true);
        setTimeout(() => setCandleFlash(false), 600);
      }

      setCandleData((prev) => {
        const nextCandles = [...prev];
        const existingIndex = nextCandles.findIndex((c) => c.time === bucketTime);

        if (existingIndex >= 0) {
          const existing = nextCandles[existingIndex];
          const updated = {
            ...existing,
            high: Math.max(existing.high, newCandle.high),
            low: Math.min(existing.low, newCandle.low),
            close: newCandle.close,
          };

          if (
            updated.high === existing.high &&
            updated.low === existing.low &&
            updated.close === existing.close
          ) {
            return prev;
          }

          nextCandles[existingIndex] = updated;
        } else {
          nextCandles.push({
            time: bucketTime,
            open: newCandle.open,
            high: newCandle.high,
            low: newCandle.low,
            close: newCandle.close,
          });
        }

        const merged = nextCandles.sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );

        const high = Math.max(...merged.map((c) => c.high));
        const low = Math.min(...merged.map((c) => c.low));
        setHighPrice(high);
        setLowPrice(low);
        setChartData(
          merged.map((d) => ({
            time: format(new Date(d.time), timeFmt),
            price: Number(d.close),
          })),
        );

        return merged;
      });
      return;
    }

    if (lastCandleTimeRef.current !== newCandle.time) {
      lastCandleTimeRef.current = newCandle.time;
      setCandleFlash(true);
      setTimeout(() => setCandleFlash(false), 600);
    }

    setCandleData(prev => {
      if (prev.length === 0) return [newCandle];
      
      const candleMap = new Map(prev.map(c => [c.time, c]));
      const existing = candleMap.get(newCandle.time);
      
      // Skip if no change
      if (existing && 
          existing.open === newCandle.open && 
          existing.high === newCandle.high &&
          existing.low === newCandle.low &&
          existing.close === newCandle.close) {
        return prev;
      }
      
      candleMap.set(newCandle.time, newCandle);
      
      const merged = Array.from(candleMap.values())
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      const high = Math.max(...merged.map(c => c.high));
      const low = Math.min(...merged.map(c => c.low));
      setHighPrice(high);
      setLowPrice(low);

      setChartData(merged.map(d => {
        const dateObj = new Date(d.time);
        const timeStr = isNaN(dateObj.getTime()) ? d.time : format(dateObj, timeFmt);
        return {
          time: timeStr,
          price: Number(d.close),
        };
      }));
      
      return merged;
    });
  }, [timeframe]);

  // Handle product updates from realtime
  const handleProductUpdate = useCallback((newProduct: Partial<Product>) => {
    setProduct(prev => prev ? { ...prev, ...newProduct } : null);
    if (newProduct.high_24h) setHighPrice(newProduct.high_24h);
    if (newProduct.low_24h) setLowPrice(newProduct.low_24h);
  }, []);

  // Use optimized realtime hook for product data
  const { 
    status: realtimeStatus, 
    stats: realtimeStats, 
    reconnect: reconnectRealtime,
    isConnected 
  } = useProductRealtime({
    productId: id || '',
    enabled: !!id && isValidUUID(id),
    onCandleUpdate: handleCandleUpdate,
    onProductUpdate: handleProductUpdate,
    throttleMs: THROTTLE_MS[timeframe] || 200,
    reconnectDelay: 2000,
    maxReconnectAttempts: 5,
  });

  // Use optimized realtime hook for user trades
  useUserTradesRealtime({
    userId: user?.id || '',
    productId: id,
    enabled: !!user && !!id && isValidUUID(id),
    onTradeUpdate: fetchActivePositionCount,
    debounceMs: 300,
  });

  // Auto-sync external data every 15 seconds (reduced since realtime handles price updates)
  useAutoSync({ 
    enabled: !!user && isValidUUID(id),
    interval: 15000,
    onSuccess: () => {}
  });

  useEffect(() => {
    if (isValidUUID(id)) {
      fetchProduct();
      fetchActivePositionCount();
    } else if (id) {
      setLoading(false);
    }
  }, [id, isValidUUID, fetchActivePositionCount]);

  useEffect(() => {
    if (isValidUUID(id)) {
      if (product) {
        fetchPriceHistory(timeframe);
      }
    }
  }, [id, timeframe, isValidUUID, product?.name]);

  // Fallback polling when realtime is not connected
  useEffect(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    // Only poll if not connected via realtime
    if (!isConnected && isValidUUID(id)) {
      fallbackIntervalRef.current = setInterval(() => {
        refreshLatestCandles();
      }, 5000);
    }

    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [isConnected, id, isValidUUID]);

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

  // Fetch candle data from local price_history table for LOCAL_CHART_PRODUCTS
  const fetchLocalPriceHistory = async (tf: "1m" | "5m" | "15m" | "30m" | "1h" | "1d") => {
    if (!id || !product) return;
    setPriceHistoryLoading(true);
    setNextCursor(null);

    try {
      // Determine how far back to look based on timeframe
      // Aim for ~60-100 aggregated candles per view to match admin chart density
      const now = new Date();
      const lookbackMs: Record<string, number> = {
        "1m": 2 * 60 * 60 * 1000,         // 2 hours → ~120 candles
        "5m": 6 * 60 * 60 * 1000,         // 6 hours → ~72 candles
        "15m": 18 * 60 * 60 * 1000,       // 18 hours → ~72 candles
        "30m": 24 * 60 * 60 * 1000,       // 24 hours → ~48 candles
        "1h": 3 * 24 * 60 * 60 * 1000,    // 3 days → ~72 candles
        "1d": 60 * 24 * 60 * 60 * 1000,   // 60 days → ~60 candles
      };
      const since = new Date(now.getTime() - (lookbackMs[tf] || lookbackMs["30m"])).toISOString();

      const { data: rows, error } = await supabase
        .from("price_history")
        .select("recorded_at, open_price, high_price, low_price, close_price")
        .eq("product_id", id)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(1000);

      if (error) {
        console.error("Local price_history fetch error", error);
        setCandleData([]);
        setChartData([]);
        setPriceHistoryLoading(false);
        return;
      }

      if (!rows || rows.length === 0) {
        // Fallback: get latest 200 records regardless of time
        const { data: fallbackRows } = await supabase
          .from("price_history")
          .select("recorded_at, open_price, high_price, low_price, close_price")
          .eq("product_id", id)
          .order("recorded_at", { ascending: false })
          .limit(200);

        if (fallbackRows && fallbackRows.length > 0) {
          const sorted = fallbackRows.reverse();
          processLocalCandles(sorted, tf);
        } else {
          setCandleData([]);
          setChartData([]);
          setHighPrice(null);
          setLowPrice(null);
        }
        setPriceHistoryLoading(false);
        return;
      }

      processLocalCandles(rows, tf);
    } catch (err) {
      console.error("fetchLocalPriceHistory error", err);
      setCandleData([]);
      setChartData([]);
    }
    setPriceHistoryLoading(false);
  };

  // Aggregate raw price records into OHLC candles based on timeframe
  // Uses same bucketing logic as admin's chartUtils.aggregateCandles for consistency
  const aggregateCandles = (rows: Array<{ recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number }>, tf: string): OHLCData[] => {
    if (rows.length === 0) return [];

    // Timeframe in seconds (matching admin's chartUtils)
    const secondsMap: Record<string, number> = {
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "30m": 1800,
      "1h": 3600,
      "1d": 86400,
    };
    const bucketSize = secondsMap[tf] || 1800;

    // Group records into timeframe buckets using unix seconds (same as admin)
    const buckets = new Map<number, { open: number; high: number; low: number; close: number; firstTs: number }>();

    for (const row of rows) {
      const tsSec = Math.floor(new Date(row.recorded_at).getTime() / 1000);
      const key = Math.floor(tsSec / bucketSize) * bucketSize;
      const existing = buckets.get(key);
      
      if (!existing) {
        buckets.set(key, {
          open: row.open_price,
          high: row.high_price,
          low: row.low_price,
          close: row.close_price,
          firstTs: tsSec,
        });
      } else {
        existing.high = Math.max(existing.high, row.high_price);
        existing.low = Math.min(existing.low, row.low_price);
        // Update close to latest record in bucket
        if (tsSec >= existing.firstTs) {
          existing.close = row.close_price;
        }
      }
    }

    // Convert to OHLCData sorted by time
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([key, bucket]) => ({
        time: new Date(key * 1000).toISOString(),
        open: bucket.open,
        high: bucket.high,
        low: bucket.low,
        close: bucket.close,
      }));
  };

  const processLocalCandles = (rows: Array<{ recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number }>, tf: string) => {
    const timeFmt = tf === "1m" || tf === "5m" || tf === "15m" || tf === "30m" ? "HH:mm" : tf === "1h" ? "MM/dd HH:mm" : "MM/dd";

    const candles = aggregateCandles(rows, tf);

    setCandleData(candles);
    if (candles.length > 0) {
      const high = Math.max(...candles.map(c => c.high));
      const low = Math.min(...candles.map(c => c.low));
      setHighPrice(high);
      setLowPrice(low);
    }
    setChartData(candles.map(d => ({ time: format(new Date(d.time), timeFmt), price: Number(d.close) })));
  };

  const fetchPriceHistory = async (tf: "1m" | "5m" | "15m" | "30m" | "1h" | "1d") => {
    if (!id) return;

    // All products use local DB
    if (USE_LOCAL_CHART) {
      return fetchLocalPriceHistory(tf);
    }

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

      const high = Math.max(...candles.map(c => c.high));
      const low = Math.min(...candles.map(c => c.low));
      setHighPrice(high);
      setLowPrice(low);

      const timeFmt = tf === "1m" || tf === "5m" || tf === "15m" || tf === "30m" ? "HH:mm" : tf === "1h" ? "MM/dd HH:mm" : "MM/dd";
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

    const now = Date.now();
    const ttl = CACHE_TTL[timeframe] || 1000;
    if (now - lastRefreshRef.current < ttl) {
      return;
    }
    lastRefreshRef.current = now;

    const cacheKey = `refresh_${id}_${timeframe}`;
    const cached = candleCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < ttl) {
      return;
    }

    const latestSince = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("price_history")
      .select("recorded_at, open_price, high_price, low_price, close_price")
      .eq("product_id", id)
      .gte("recorded_at", latestSince)
      .order("recorded_at", { ascending: true })
      .limit(240);

    if (error || !rows || rows.length === 0) return;

    const latestCandles = aggregateCandles(rows, timeframe);
    if (latestCandles.length === 0) return;

    candleCache.set(cacheKey, {
      data: latestCandles,
      timestamp: now,
      nextCursor: null,
    });

    const timeFmt = timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "30m" ? "HH:mm" : timeframe === "1h" ? "MM/dd HH:mm" : "MM/dd";

    setCandleData((prev) => {
      const map = new Map<string, OHLCData>();
      for (const c of prev) map.set(c.time, c);

      let hasChanges = false;
      for (const c of latestCandles.slice(-3)) {
        const existing = map.get(c.time);
        if (!existing || existing.open !== c.open || existing.high !== c.high || existing.low !== c.low || existing.close !== c.close) {
          map.set(c.time, c);
          hasChanges = true;
        }
      }

      if (!hasChanges) return prev;

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      );

      setChartData(
        merged.map((d) => ({
          time: format(new Date(d.time), timeFmt),
          price: Number(d.close),
        })),
      );

      const high = Math.max(...merged.map((c) => c.high));
      const low = Math.min(...merged.map((c) => c.low));
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
      const timeFmt = timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "30m" ? "HH:mm" : timeframe === "1h" ? "MM/dd HH:mm" : "MM/dd";

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
          <p className="text-muted-foreground">{t('product.notFound')}</p>
          <Button onClick={() => navigate("/products")}>{t('product.goBack')}</Button>
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
            {/* Realtime connection status - using memoized component */}
            <RealtimeStatusIndicator
              status={realtimeStatus}
              updateCount={realtimeStats.updateCount}
              reconnectCount={realtimeStats.reconnectCount}
              onReconnect={reconnectRealtime}
              showReconnectButton={realtimeStatus === 'disconnected'}
            />
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
              <span className="text-muted-foreground">{t('product.highest24h')}</span>
              <AnimatedStat value={product.high_24h ? formatPrice(product.high_24h) : (highPrice ? formatPrice(highPrice) : null)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('product.lowest24h')}</span>
              <AnimatedStat value={product.low_24h ? formatPrice(product.low_24h) : (lowPrice ? formatPrice(lowPrice) : null)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('product.volume24h')}</span>
              <AnimatedStat value={formatVolume(product.volume)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('product.turnover24h')}</span>
              <AnimatedStat value={formatVolume(product.turnover || product.volume)} className="font-medium" />
            </div>
          </div>
        </div>

        {/* Chart with Timeframe Controls */}
        <Card className="bg-card border-border">
          <CardContent className="p-0 overflow-hidden">
            {/* Timeframe selector */}
            <div className="flex items-center gap-1 px-3 pt-3 pb-1">
              {(["1m", "5m", "15m", "30m", "1h", "1d"] as const).map((tf) => (
                <Button
                  key={tf}
                  size="sm"
                  variant={timeframe === tf ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs font-mono"
                  onClick={() => setTimeframe(tf)}
                >
                  {tf.toUpperCase()}
                </Button>
              ))}
            </div>
            <div style={{ height: '320px' }} className="w-full">
              {candleData.length > 0 ? (
                <MemoizedCandlestickChart
                  data={candleData}
                  height={320}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {priceHistoryLoading ? 'Loading chart...' : 'No chart data available'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>


        {/* Position Section */}
        <div className="px-1">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <span className="text-sm text-muted-foreground">{t('product.position')}({activePositionCount})</span>
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
              {t('product.noPosition')}
            </div>
          )}
        </div>

        {/* Buy Up / Buy Down Buttons - Large touch targets for mobile */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border/50 safe-area-margin-bottom">
          <div className="max-w-md mx-auto flex gap-3">
            <Button 
              className="flex-1 min-h-[52px] h-13 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-base font-semibold rounded-lg touch-action-manipulation transition-colors"
              onClick={() => {
                if (!user) {
                  toast({ title: t('options.pleaseLogin'), variant: 'destructive' });
                  navigate('/login');
                  return;
                }
                console.log('Clicked Buy Up - setting direction to buy');
                setTradeDirection('buy');
                setOptionsSheetOpen(true);
              }}
            >
              {t('options.buyUp')}
            </Button>
            <Button 
              className="flex-1 min-h-[52px] h-13 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-base font-semibold rounded-lg touch-action-manipulation transition-colors"
              onClick={() => {
                if (!user) {
                  toast({ title: t('options.pleaseLogin'), variant: 'destructive' });
                  navigate('/login');
                  return;
                }
                console.log('Clicked Buy Down - setting direction to sell');
                setTradeDirection('sell');
                setOptionsSheetOpen(true);
              }}
            >
              {t('options.buyDown')}
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
            initialDirection={tradeDirection}
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
