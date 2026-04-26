import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface OptionTrade {
  id: string;
  product_id: string;
  direction: 'buy' | 'sell';
  amount: number;
  entry_price: number;
  duration_seconds: number;
  profit_rate: number;
  status: 'active' | 'won' | 'lost' | 'cancelled';
  started_at: string;
  expires_at: string;
  exit_price: number | null;
  profit_loss: number | null;
}

interface ActiveOptionTradeProps {
  productId: string;
  currentPrice: number | null;
  onSettled?: () => void;
}

export function ActiveOptionTrade({ productId, currentPrice, onSettled }: ActiveOptionTradeProps) {
  const { user } = useAuth();
  const [activeTrade, setActiveTrade] = useState<OptionTrade | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [settling, setSettling] = useState(false);

  const fetchActiveTrade = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('option_trades')
      .select('*')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setActiveTrade(data as OptionTrade);
    } else {
      setActiveTrade(null);
    }
  }, [user, productId]);

  // Fetch on mount and subscribe to realtime updates
  useEffect(() => {
    fetchActiveTrade();

    if (!user) return;

    const channel = supabase
      .channel(`option_trades_${productId}_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'option_trades',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as OptionTrade).product_id === productId) {
            if ((payload.new as OptionTrade).status === 'active') {
              setActiveTrade(payload.new as OptionTrade);
            } else {
              setActiveTrade(null);
              onSettled?.();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, productId, fetchActiveTrade, onSettled]);

  // Countdown timer
  useEffect(() => {
    if (!activeTrade) {
      setTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expires = new Date(activeTrade.expires_at).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(remaining);

      // Auto-settle when timer reaches 0
      if (remaining === 0 && !settling) {
        handleSettle();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeTrade, settling]);

  const handleSettle = async () => {
    if (!activeTrade || settling) return;
    setSettling(true);

    try {
      const exitPrice = currentPrice || activeTrade.entry_price;
      
      const { error } = await supabase.rpc('settle_option_trade', {
        _trade_id: activeTrade.id,
        _exit_price: exitPrice,
      });

      if (error) {
        console.error('Settle error:', error);
      }
    } catch (err) {
      console.error('Settlement failed:', err);
    } finally {
      setSettling(false);
    }
  };

  if (!activeTrade) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = activeTrade.duration_seconds > 0 
    ? ((activeTrade.duration_seconds - timeLeft) / activeTrade.duration_seconds) * 100 
    : 100;

  const isBuy = activeTrade.direction === 'buy';
  const expectedProfit = activeTrade.amount * activeTrade.profit_rate;
  const currentPriceVal = currentPrice || activeTrade.entry_price;
  const priceChange = ((currentPriceVal - activeTrade.entry_price) / activeTrade.entry_price) * 100;
  const isWinning = isBuy ? priceChange > 0 : priceChange < 0;

  return (
    <Card className={cn(
      "border-2 transition-colors",
      isWinning ? "border-green-500/50 bg-green-500/5" : "border-red-500/50 bg-red-500/5"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isBuy ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            <Badge variant={isBuy ? "default" : "destructive"}>
              {isBuy ? 'MUA' : 'BÁN'}
            </Badge>
            <span className="font-semibold">${activeTrade.amount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-lg font-bold">
            <Clock className="h-5 w-5" />
            <span className={timeLeft <= 30 ? "text-red-500" : ""}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
          <div 
            className={cn(
              "h-full transition-all duration-1000",
              isWinning ? "bg-green-500" : "bg-red-500"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Trade Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Giá vào</span>
            <p className="font-medium">${activeTrade.entry_price.toFixed(4)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Giá hiện tại</span>
            <p className={cn("font-medium", isWinning ? "text-green-500" : "text-red-500")}>
              ${currentPriceVal.toFixed(4)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Biến động</span>
            <p className={cn("font-medium", priceChange >= 0 ? "text-green-500" : "text-red-500")}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Lợi nhuận dự kiến</span>
            <p className="font-medium text-green-500">+${expectedProfit.toFixed(2)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}