import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { OptionsTradeSheet } from "@/components/product/OptionsTradeSheet";
import { ActiveOptionTrade } from "@/components/product/ActiveOptionTrade";
import { AnimatedPrice, AnimatedStat } from "@/components/product/AnimatedPrice";
import { MiniPriceChart } from "@/components/product/MiniPriceChart";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { CandlestickChart } from "@/components/charts/CandlestickChart";
import { TransactionHistorySheet } from "@/components/product/TransactionHistorySheet";
import { RealtimeStatusIndicator } from "@/components/charts/RealtimeStatusIndicator";
import { useUserTradesRealtime } from "@/hooks/useProductRealtime";
import { useSharedProductRealtime, isValidProductId } from "@/hooks/useSharedProductRealtime";
import { PageSeo } from "@/components/seo/PageSeo";

// Throttle intervals based on timeframe (faster timeframes need faster updates)
const THROTTLE_MS: Record<string, number> = {
  "1m": 100,
  "5m": 200,
  "15m": 300,
  "30m": 500,
  "1h": 500,
  "1d": 1000,
};

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "1d";
const VALID_TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "30m", "1h", "1d"];

// Memoized chart wrapper to prevent unnecessary re-renders
const MemoizedCandlestickChart = memo(CandlestickChart);

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    const saved = localStorage.getItem('chart_timeframe');
    return saved && (VALID_TIMEFRAMES as string[]).includes(saved) ? (saved as Timeframe) : "30m";
  });

  useEffect(() => {
    localStorage.setItem('chart_timeframe', timeframe);
  }, [timeframe]);

  const [optionsSheetOpen, setOptionsSheetOpen] = useState(false);
  const [tradeDirection, setTradeDirection] = useState<'buy' | 'sell'>('buy');
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [activePositionCount, setActivePositionCount] = useState(0);

  const validId = isValidProductId(id);

  const sharedRealtime = useSharedProductRealtime({
    productId: id || '',
    timeframe,
    enabled: validId,
    throttleMs: THROTTLE_MS[timeframe] || 200,
  });

  const product = sharedRealtime.product;
  const effectiveCandleData = sharedRealtime.candles;
  const displayPrice = sharedRealtime.latestPrice;
  const highPrice = sharedRealtime.highPrice;
  const lowPrice = sharedRealtime.lowPrice;
  const loading = sharedRealtime.isLoading;
  const realtimeStatus = sharedRealtime.status;
  const realtimeStats = sharedRealtime.stats;
  const reconnectRealtime = sharedRealtime.reconnect;

  // Fetch active position count for the current user/product
  const fetchActivePositionCount = useCallback(async () => {
    if (!user || !id || !validId) return;
    const { count, error } = await supabase
      .from("option_trades")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("product_id", id)
      .eq("status", "active");
    if (!error && count !== null) setActivePositionCount(count);
  }, [user, id, validId]);

  useEffect(() => {
    fetchActivePositionCount();
  }, [fetchActivePositionCount]);

  useUserTradesRealtime({
    userId: user?.id || '',
    productId: id,
    enabled: !!user && validId,
    onTradeUpdate: fetchActivePositionCount,
    debounceMs: 300,
  });

  // Reset zoom only when the product changes — switching timeframe just re-aggregates
  // the same raw rows client-side and should preserve the user's pan/zoom feeling.
  const resetZoomKey = useMemo(() => `${id || 'none'}`, [id]);
  const visibleRangeKey = useMemo(() => `${id || 'none'}::${timeframe}`, [id, timeframe]);

  const priceChange = product?.price_change ?? 0;
  const isPositive = priceChange >= 0;

  const formatPrice = (price: number | null | undefined): string => {
    if (price === null || price === undefined || !Number.isFinite(Number(price))) return "—";
    const n = Number(price);
    if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(4);
  };

  const formatVolume = (volume: string | null | undefined): string => {
    if (!volume) return "—";
    const num = parseFloat(volume);
    if (!Number.isFinite(num) || num <= 0) return "—";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return String(volume);
  };

  if (!validId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">{t('product.notFound')}</p>
          <Button onClick={() => navigate("/products")}>{t('product.goBack')}</Button>
        </div>
      </Layout>
    );
  }

  if (loading && !product) {
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

  return (
    <Layout hideFooter>
      <PageSeo
        title={`${product.symbol || product.name} | ST Engineering`}
        description={`${product.name} — giá thời gian thực, biểu đồ nến và giao dịch options trên ST Engineering.`}
        path={`/product/${product.id}`}
      />
      <div className="space-y-3 pb-24 bg-background min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between sticky top-0 z-20 bg-background/95 backdrop-blur-sm py-2 px-1 -mx-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/products")} className="h-8 w-8">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-medium truncate max-w-[120px]">{product.symbol || product.name}</h1>
            <MiniPriceChart
              data={effectiveCandleData.slice(-20).map(c => c.close)}
              width={50}
              height={20}
            />
            <span className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </span>
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

        {/* Price + stats */}
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
              <AnimatedStat value={formatPrice(highPrice)} className="font-medium" />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t('product.lowest24h')}</span>
              <AnimatedStat value={formatPrice(lowPrice)} className="font-medium" />
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

        {/* Chart */}
        <Card className="bg-card border-border">
          <CardContent className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <div className="flex items-center gap-1">
                {VALID_TIMEFRAMES.map((tf) => (
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
            </div>
            <div style={{ height: '320px' }} className="w-full">
              {effectiveCandleData.length > 0 ? (
                <MemoizedCandlestickChart
                  data={effectiveCandleData}
                  height={320}
                  resetZoomKey={resetZoomKey}
                  visibleRangeKey={visibleRangeKey}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  {loading ? 'Loading chart...' : 'No chart data available'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Position */}
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

          {user && (
            <div className="mt-3">
              <ActiveOptionTrade
                productId={product.id}
                currentPrice={displayPrice}
                onSettled={fetchActivePositionCount}
              />
            </div>
          )}

          {activePositionCount === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('product.noPosition')}
            </div>
          )}
        </div>

        {/* Buy Up / Buy Down */}
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
                setTradeDirection('buy');
                setOptionsSheetOpen(true);
              }}
            >
              MUA
            </Button>
            <Button
              className="flex-1 min-h-[52px] h-13 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-base font-semibold rounded-lg touch-action-manipulation transition-colors"
              onClick={() => {
                if (!user) {
                  toast({ title: t('options.pleaseLogin'), variant: 'destructive' });
                  navigate('/login');
                  return;
                }
                setTradeDirection('sell');
                setOptionsSheetOpen(true);
              }}
            >
              BÁN
            </Button>
          </div>
        </div>

        <OptionsTradeSheet
          isOpen={optionsSheetOpen}
          onClose={() => setOptionsSheetOpen(false)}
          product={{
            id: product.id,
            name: product.name ?? '',
            symbol: product.symbol,
            price: displayPrice,
          }}
          initialDirection={tradeDirection}
          onSuccess={fetchActivePositionCount}
        />

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
