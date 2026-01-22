import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, LineChart as LineIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Layout } from "@/components/layout/Layout";
import { TradeDialog } from "@/components/product/TradeDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CandlestickChart, OHLCData } from "@/components/charts/CandlestickChart";
import { format } from "date-fns";

interface Product {
  id: string;
  name: string;
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
  const [tradeDialogOpen, setTradeDialogOpen] = useState(false);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPriceHistory(timeframe);
    }
  }, [id, timeframe]);

  // Auto-refresh for short timeframes so candles stay up-to-date.
  // - 1m: poll every 1s
  // - 30m: poll every 30s
  useEffect(() => {
    if (!id) return;
    if (timeframe !== "1m" && timeframe !== "30m") return;

    const intervalMs = timeframe === "1m" ? 1000 : 30_000;
    const handle = window.setInterval(() => {
      // Avoid background polling when tab is hidden.
      if (document.visibilityState === "hidden") return;
      // Avoid stacking requests.
      if (priceHistoryLoading || paging) return;
      fetchPriceHistory(timeframe);
    }, intervalMs);

    return () => window.clearInterval(handle);
  }, [id, timeframe, priceHistoryLoading, paging]);

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

      // Prepend older candles, de-dupe by exact time, then rebuild line-series labels from merged candles.
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
    <Layout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            {product.image_url && (
              <img src={product.image_url} alt={product.name} className="w-8 h-8 rounded-full" />
            )}
            <h1 className="text-xl font-bold">{product.name}</h1>
          </div>
        </div>

        {/* Price Info */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-primary">
                ${formatPrice(product.price)}
              </span>
              <span className={`flex items-center text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {isPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {isPositive ? "+" : ""}{product.price_change?.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Vol 24H: {product.volume || "0"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            {/* Timeframe and Chart Type Controls */}
            <div className="flex gap-2 mb-4">
              {/* Timeframe buttons */}
              {(["1m", "30m", "1h", "1d"] as const).map((tf) => (
                <Button
                  key={tf}
                  variant={timeframe === tf ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTimeframe(tf)}
                  className="flex-1"
                >
                  {tf}
                </Button>
              ))}
              
              {/* Chart type toggle */}
              <div className="flex gap-1 ml-2 border-l border-border pl-2">
                <Button
                  size="sm"
                  variant={chartType === 'candle' ? 'default' : 'outline'}
                  onClick={() => setChartType('candle')}
                  className="px-2"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={chartType === 'line' ? 'default' : 'outline'}
                  onClick={() => setChartType('line')}
                  className="px-2"
                >
                  <LineIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Chart */}
            <div className="h-72">
              {priceHistoryLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : chartType === 'candle' ? (
                <CandlestickChart data={candleData} height={280} />
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

            {chartType === "candle" && (
              <div className="mt-3 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!nextCursor || paging}
                  onClick={loadMoreHistory}
                >
                  {paging ? "Đang tải..." : nextCursor ? "Tải thêm" : "Hết dữ liệu"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="w-full bg-muted/50">
            <TabsTrigger value="history" className="flex-1">Lịch sử GD</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">Thông tin</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="mt-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 text-center text-muted-foreground">
                <p className="text-sm">Chưa có giao dịch nào cho sản phẩm này</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="mt-4">
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá hiện tại</span>
                  <span className="font-medium">${formatPrice(product.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Khối lượng 24H</span>
                  <span className="font-medium">{product.volume || "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Thay đổi 24H</span>
                  <span className={`font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}>
                    {isPositive ? "+" : ""}{product.price_change?.toFixed(2)}%
                  </span>
                </div>
                {product.description && (
                  <div className="pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">{product.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Trade Buttons */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t border-border/50">
          <div className="flex gap-3 max-w-md mx-auto">
            <Button 
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                if (!user) {
                  toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
                  navigate('/auth');
                  return;
                }
                setTradeType('buy');
                setTradeDialogOpen(true);
              }}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Mua
            </Button>
            <Button 
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (!user) {
                  toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
                  navigate('/auth');
                  return;
                }
                setTradeType('sell');
                setTradeDialogOpen(true);
              }}
            >
              <TrendingDown className="h-4 w-4 mr-2" />
              Bán
            </Button>
          </div>
        </div>

        {/* Trade Dialog */}
        {product && (
          <TradeDialog
            isOpen={tradeDialogOpen}
            onClose={() => setTradeDialogOpen(false)}
            tradeType={tradeType}
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
            }}
            onSuccess={fetchProduct}
          />
        )}
      </div>
    </Layout>
  );
};

export default ProductDetail;
