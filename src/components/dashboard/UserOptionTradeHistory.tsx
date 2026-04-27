import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface OptionTrade {
  id: string;
  product_id: string;
  direction: string;
  amount: number;
  entry_price: number;
  exit_price: number | null;
  profit_loss: number | null;
  status: string;
  duration_seconds: number;
  created_at: string;
  settled_at: string | null;
}

type ProductLookup = Record<string, { name: string; symbol: string | null }>;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);

const getStatusLabel = (trade: OptionTrade) => {
  if (trade.status === "active") return "Đang chạy";
  if (trade.status === "won" || (trade.profit_loss ?? 0) > 0) return "Thắng";
  if (trade.status === "lost" || (trade.profit_loss ?? 0) < 0) return "Thua";
  return "Hoàn tất";
};

export function UserOptionTradeHistory() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<OptionTrade[]>([]);
  const [products, setProducts] = useState<ProductLookup>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchTrades = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("option_trades")
        .select("id, product_id, direction, amount, entry_price, exit_price, profit_loss, status, duration_seconds, created_at, settled_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching option trade history:", error);
        setTrades([]);
        setLoading(false);
        return;
      }

      const tradeRows = (data || []) as OptionTrade[];
      setTrades(tradeRows);

      const productIds = Array.from(new Set(tradeRows.map((trade) => trade.product_id).filter(Boolean)));
      if (productIds.length > 0) {
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select("id, name, symbol")
          .in("id", productIds);

        if (!productError) {
          setProducts(
            Object.fromEntries(
              (productData || []).map((product) => [product.id, { name: product.name, symbol: product.symbol }])
            )
          );
        }
      }

      setLoading(false);
    };

    fetchTrades();
  }, [user]);

  const summary = useMemo(() => {
    return trades.reduce(
      (acc, trade) => {
        acc.total += trade.profit_loss || 0;
        if (trade.status === "active") acc.active += 1;
        if ((trade.profit_loss || 0) > 0 || trade.status === "won") acc.won += 1;
        if ((trade.profit_loss || 0) < 0 || trade.status === "lost") acc.lost += 1;
        return acc;
      },
      { total: 0, active: 0, won: 0, lost: 0 }
    );
  }, [trades]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Lịch sử giao dịch quyền chọn</h2>
        <p className="text-sm text-muted-foreground">Theo dõi các lệnh đã đặt, kết quả và lợi nhuận trực tiếp từ lịch sử giao dịch.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tổng lệnh</p><p className="text-2xl font-bold">{trades.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Đang chạy</p><p className="text-2xl font-bold">{summary.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Thắng / Thua</p><p className="text-2xl font-bold">{summary.won}/{summary.lost}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lợi nhuận</p><p className={cn("text-2xl font-bold", summary.total >= 0 ? "text-secondary" : "text-destructive")}>{summary.total >= 0 ? "+" : ""}{formatCurrency(summary.total)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">50 giao dịch gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : trades.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chưa có giao dịch quyền chọn</div>
          ) : (
            <div className="divide-y divide-border">
              {trades.map((trade) => {
                const product = products[trade.product_id];
                const isUp = trade.direction === "buy";
                const profitLoss = trade.profit_loss || 0;

                return (
                  <div key={trade.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted", isUp ? "text-secondary" : "text-destructive")}>
                        {isUp ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{product?.name || "Sản phẩm"}</p>
                          {product?.symbol && <Badge variant="outline">{product.symbol}</Badge>}
                          <Badge variant="secondary">{isUp ? "Lệnh Mua" : "Lệnh Bán"}</Badge>
                          <Badge variant={trade.status === "active" ? "outline" : profitLoss < 0 ? "destructive" : "default"}>{getStatusLabel(trade)}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{format(new Date(trade.created_at), "dd/MM/yyyy HH:mm")}</span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{trade.duration_seconds}s</span>
                          <span>Vào: {trade.entry_price.toFixed(4)}</span>
                          {trade.exit_price !== null && <span>Ra: {trade.exit_price.toFixed(4)}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 md:block md:text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Số tiền</p>
                        <p className="font-semibold">{formatCurrency(trade.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lãi/Lỗ</p>
                        <p className={cn("font-semibold", profitLoss >= 0 ? "text-secondary" : "text-destructive")}>{profitLoss >= 0 ? "+" : ""}{formatCurrency(profitLoss)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}