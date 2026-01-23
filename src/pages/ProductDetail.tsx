import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, LineChart as LineIcon, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Layout } from "@/components/layout/Layout";
import { OptionsTradeSheet } from "@/components/product/OptionsTradeSheet";
import { ActiveOptionTrade } from "@/components/product/ActiveOptionTrade";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CandlestickChart, OHLCData } from "@/components/charts/CandlestickChart";
import { ChartIndicators, IndicatorConfig, defaultIndicatorConfig } from "@/components/charts/ChartIndicators";
import { TransactionHistorySheet } from "@/components/product/TransactionHistorySheet";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
  symbol?: string | null;
  price: number | null;
  volume: string | null;
  price_change: number | null;
  image_url: string | null;
  description: string | null;
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
        {/* Header with back button, product name and history icon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/products")} className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-medium truncate max-w-[200px]">{product.name}</h1>
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
            <div className={`text-2xl font-bold ${isPositive ? "text-green-500" : "text-red-500"}`}>
              {formatPrice(product.price)}
            </div>
            <div className="text-xs text-muted-foreground">
              ≈{formatPrice(product.price)}
            </div>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h highest price</span>
              <span className="text-cyan-400 font-medium">{highPrice ? formatPrice(highPrice) : "--"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h lowest price</span>
              <span className="text-cyan-400 font-medium">{lowPrice ? formatPrice(lowPrice) : "--"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h trading volume</span>
              <span className="text-cyan-400 font-medium">{formatVolume(product.volume)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">24h turnover</span>
              <span className="text-cyan-400 font-medium">{formatVolume(product.volume)}</span>
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
        <Card className="bg-card border-border">
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

        {chartType === "candle" && nextCursor && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={paging}
              onClick={loadMoreHistory}
            >
              {paging ? "Đang tải..." : "Tải thêm"}
            </Button>
          </div>
        )}

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
