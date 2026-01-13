import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

interface TradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tradeType: 'buy' | 'sell';
  product: {
    id: string;
    name: string;
    price: number | null;
  };
  onSuccess: () => void;
}

export function TradeDialog({ isOpen, onClose, tradeType, product, onSuccess }: TradeDialogProps) {
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingBalance, setIsFetchingBalance] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const price = product.price || 0;
  const total = parseFloat(amount || '0') * price;

  useEffect(() => {
    if (isOpen && user) {
      fetchBalance();
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  const fetchBalance = async () => {
    setIsFetchingBalance(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user!.id)
      .single();

    if (!error && data) {
      setBalance(data.balance || 0);
    }
    setIsFetchingBalance(false);
  };

  const handleTrade = async () => {
    if (!user || !amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Lỗi',
        description: 'Vui lòng nhập số lượng hợp lệ',
        variant: 'destructive',
      });
      return;
    }

    // Client-side validation for UX (server validates again)
    if (tradeType === 'buy' && total > balance) {
      toast({
        title: 'Số dư không đủ',
        description: `Bạn cần ${formatCurrency(total)} nhưng chỉ có ${formatCurrency(balance)}`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use secure server-side RPC function for atomic trade processing
      const { data, error } = await supabase.rpc('process_trade', {
        _user_id: user.id,
        _product_id: product.id,
        _amount: parseFloat(amount),
        _trade_type: tradeType,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; total?: number; new_balance?: number };

      if (!result.success) {
        toast({
          title: 'Lỗi',
          description: result.error || 'Không thể thực hiện giao dịch',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Thành công',
        description: `Đã ${tradeType === 'buy' ? 'mua' : 'bán'} ${amount} ${product.name}`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Trade error:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể thực hiện giao dịch',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const isBuy = tradeType === 'buy';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
            {isBuy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            {isBuy ? 'Mua' : 'Bán'} {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Balance Info */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Số dư hiện tại</span>
            </div>
            <span className="font-bold text-primary">
              {isFetchingBalance ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                formatCurrency(balance)
              )}
            </span>
          </div>

          {/* Price Info */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Giá hiện tại</span>
            <span className="font-medium">{formatCurrency(price)}</span>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Số lượng</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          {/* Quick Amount Buttons */}
          {isBuy && (
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((percent) => (
                <Button
                  key={percent}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const maxAmount = balance / price;
                    setAmount(((maxAmount * percent) / 100).toFixed(4));
                  }}
                >
                  {percent}%
                </Button>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Tổng giá trị</span>
            <span className={`font-bold ${isBuy ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(total)}
            </span>
          </div>

          {/* Balance After */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Số dư sau giao dịch</span>
            <span className="font-medium">
              {formatCurrency(isBuy ? balance - total : balance + total)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button
            onClick={handleTrade}
            disabled={isLoading || !amount || parseFloat(amount) <= 0 || (isBuy && total > balance)}
            className={isBuy ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : isBuy ? (
              <TrendingUp className="w-4 h-4 mr-2" />
            ) : (
              <TrendingDown className="w-4 h-4 mr-2" />
            )}
            {isBuy ? 'Xác nhận Mua' : 'Xác nhận Bán'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
