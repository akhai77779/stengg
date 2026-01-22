import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useExternalBalance } from '@/hooks/useExternalBalance';
import { Loader2, X, Clock, TrendingUp, TrendingDown, Wallet, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionsTradeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    symbol?: string | null;
    price: number | null;
  };
  onSuccess?: () => void;
}

interface DurationOption {
  seconds: number;
  label: string;
  profitRate: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { seconds: 240, label: '240 Thứ hai', profitRate: 0.06 },
  { seconds: 360, label: '360 Thứ hai', profitRate: 0.12 },
  { seconds: 600, label: '600 Thứ hai', profitRate: 0.18 },
];

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];
const FEE_RATE = 0.002;
const MIN_AMOUNT = 100;

export function OptionsTradeSheet({ isOpen, onClose, product, onSuccess }: OptionsTradeSheetProps) {
  const [amount, setAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DURATION_OPTIONS[0]);
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { balance, isLoading: balanceLoading, refetch: refetchBalance } = useExternalBalance(user?.id);

  const price = product.price || 0;
  const amountNum = parseFloat(amount) || 0;
  const estimatedProfit = amountNum * selectedDuration.profitRate;
  const priceEquivalent = amountNum > 0 && price > 0 ? (amountNum / price).toFixed(4) : '0';

  useEffect(() => {
    if (isOpen && user) {
      refetchBalance();
    }
  }, [isOpen, user, refetchBalance]);

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setSelectedDuration(DURATION_OPTIONS[0]);
      setDirection('buy');
    }
  }, [isOpen]);

  const handleTrade = async () => {
    if (!user) {
      toast({ title: 'Vui lòng đăng nhập', variant: 'destructive' });
      return;
    }

    if (amountNum < MIN_AMOUNT) {
      toast({ 
        title: 'Số tiền không hợp lệ', 
        description: `Tối thiểu: $${MIN_AMOUNT}`,
        variant: 'destructive' 
      });
      return;
    }

    if (balance !== null && amountNum > balance) {
      toast({ 
        title: 'Số dư không đủ', 
        description: `Cần $${amountNum.toLocaleString()} nhưng chỉ có $${balance.toLocaleString()}`,
        variant: 'destructive' 
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('process_option_trade', {
        _user_id: user.id,
        _product_id: product.id,
        _amount: amountNum,
        _direction: direction,
        _duration_seconds: selectedDuration.seconds,
        _profit_rate: selectedDuration.profitRate,
        _fee_rate: FEE_RATE,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; trade_id?: string };

      if (!result.success) {
        toast({
          title: 'Lỗi',
          description: result.error || 'Không thể đặt lệnh',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Đặt lệnh thành công!',
        description: `${direction === 'buy' ? 'MUA' : 'BÁN'} $${amountNum.toLocaleString()} - ${selectedDuration.seconds}s`,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Option trade error:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể thực hiện giao dịch',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-3xl">
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
          <SheetTitle className="text-lg">Thời gian giới hạn</SheetTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <div className="space-y-5 py-4 overflow-y-auto">
          {/* Product Info */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tên sản phẩm</span>
            <span className="font-semibold">{product.symbol || product.name}</span>
          </div>

          {/* Buy/Sell Toggle and Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Số tiền mua</span>
              <span className="text-muted-foreground/70">${amountNum.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setDirection('buy')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors",
                    direction === 'buy' 
                      ? "bg-green-600 text-white" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  MUA
                </button>
                <button
                  onClick={() => setDirection('sell')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-colors border-l border-border",
                    direction === 'sell' 
                      ? "bg-red-600 text-white" 
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  BÁN
                </button>
              </div>
              <span className="font-bold text-lg">{price.toFixed(2)}</span>
            </div>
          </div>

          {/* Balance and Fee */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Số dư khả dụng</span>
              <span className="font-semibold text-primary">
                {balanceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  formatCurrency(balance || 0)
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Phí xử lý</span>
              <span className="font-medium">{(FEE_RATE * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Duration Options */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Thời gian giao hàng</span>
            </div>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.seconds}
                  onClick={() => setSelectedDuration(opt)}
                  className={cn(
                    "flex-1 p-3 rounded-xl border-2 transition-all",
                    selectedDuration.seconds === opt.seconds
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-center gap-1 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    {opt.label}
                  </div>
                  <div className={cn(
                    "text-xs mt-1",
                    selectedDuration.seconds === opt.seconds 
                      ? "text-green-500" 
                      : "text-muted-foreground"
                  )}>
                    Lợi nhuận{(opt.profitRate * 100).toFixed(0)}%
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Số tiền mua</span>
              <span className="text-muted-foreground">Tối thiểu: {MIN_AMOUNT}</span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min={MIN_AMOUNT}
                className="pl-8 h-14 text-lg font-medium"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <Button
                key={amt}
                variant="outline"
                size="sm"
                className={cn(
                  "flex-1 rounded-full",
                  amountNum === amt && "border-primary bg-primary/10"
                )}
                onClick={() => setAmount(String(amt))}
              >
                {amt >= 1000 ? `${amt / 1000}K` : amt}
              </Button>
            ))}
          </div>

          {/* Estimated Profit */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-500 font-medium">
              Thu nhập ước tính: {formatCurrency(estimatedProfit)}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <BarChart2 className="h-4 w-4" />
              Biên độ tương đương: {priceEquivalent}
            </span>
          </div>

          {/* Submit Button */}
          <Button
            size="lg"
            className={cn(
              "w-full h-14 text-lg font-semibold rounded-xl",
              direction === 'buy'
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700"
            )}
            disabled={isLoading || amountNum < MIN_AMOUNT || (balance !== null && amountNum > balance)}
            onClick={handleTrade}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : direction === 'buy' ? (
              <TrendingUp className="h-5 w-5 mr-2" />
            ) : (
              <TrendingDown className="h-5 w-5 mr-2" />
            )}
            {direction === 'buy' ? 'Mua nó ngay bây giờ' : 'Bán nó ngay bây giờ'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
