import { useState, useEffect, forwardRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TransactionHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}

interface OptionTrade {
  id: string;
  direction: string;
  amount: number;
  entry_price: number;
  exit_price: number | null;
  profit_loss: number | null;
  status: string;
  created_at: string;
  settled_at: string | null;
  duration_seconds: number;
}

export const TransactionHistorySheet = forwardRef<HTMLDivElement, TransactionHistorySheetProps>(
  function TransactionHistorySheet({ isOpen, onClose, productId }, ref) {
    const { user } = useAuth();
    const [trades, setTrades] = useState<OptionTrade[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (isOpen && user) {
        fetchTrades();
      }
    }, [isOpen, user, productId]);

    const fetchTrades = async () => {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("option_trades")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching trades:", error);
      } else {
        setTrades(data || []);
      }
      setLoading(false);
    };

    const getStatusBadge = (status: string, profitLoss: number | null) => {
      switch (status) {
        case "active":
          return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Đang chạy</Badge>;
        case "settled":
          if (profitLoss !== null && profitLoss > 0) {
            return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Thắng</Badge>;
          } else if (profitLoss !== null && profitLoss < 0) {
            return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="h-3 w-3 mr-1" />Thua</Badge>;
          }
          return <Badge variant="outline" className="bg-muted text-muted-foreground">Hoàn thành</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
    };

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(value);
    };

    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl" ref={ref}>
          <SheetHeader className="pb-4">
            <SheetTitle>Lịch Sử Giao Dịch</SheetTitle>
          </SheetHeader>

          <div className="overflow-y-auto h-[calc(100%-60px)] space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : trades.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Chưa có giao dịch nào</p>
              </div>
            ) : (
              trades.map((trade) => (
                <div
                  key={trade.id}
                  className="bg-card/50 border border-border/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {trade.direction === "buy" ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        </div>
                      )}
                      <div>
                        <span className={`font-medium ${trade.direction === "buy" ? "text-green-500" : "text-red-500"}`}>
                          {trade.direction === "buy" ? "Buy Up" : "Buy Down"}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(trade.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(trade.status, trade.profit_loss)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Số tiền:</span>
                      <span className="ml-2 font-medium">{formatCurrency(trade.amount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Thời gian:</span>
                      <span className="ml-2 font-medium">{trade.duration_seconds}s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Giá vào:</span>
                      <span className="ml-2 font-medium">{trade.entry_price.toFixed(4)}</span>
                    </div>
                    {trade.exit_price !== null && (
                      <div>
                        <span className="text-muted-foreground">Giá ra:</span>
                        <span className="ml-2 font-medium">{trade.exit_price.toFixed(4)}</span>
                      </div>
                    )}
                  </div>

                  {trade.profit_loss !== null && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-muted-foreground text-sm">Lợi nhuận:</span>
                      <span className={`ml-2 font-bold ${trade.profit_loss >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {trade.profit_loss >= 0 ? "+" : ""}{formatCurrency(trade.profit_loss)}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
);
