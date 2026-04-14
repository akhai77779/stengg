import { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useExternalBalance } from '@/hooks/useExternalBalance';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, X, Clock, CheckCircle } from 'lucide-react';
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
  initialDirection?: 'buy' | 'sell';
  onSuccess?: () => void;
}

interface DurationOption {
  seconds: number;
  label: string;
  profitRate: number;
  lossRate: number;
  minAmount: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { seconds: 240, label: '240s', profitRate: 0.06, lossRate: 0.15, minAmount: 200 },
  { seconds: 360, label: '360s', profitRate: 0.10, lossRate: 0.12, minAmount: 10000 },
  { seconds: 600, label: '600s', profitRate: 0.15, lossRate: 0.18, minAmount: 100000 },
];

const QUICK_AMOUNTS = [200, 500, 1000, 5000, 10000];
const FEE_RATE = 0.002;
const MIN_AMOUNT = 200;

export function OptionsTradeSheet({ isOpen, onClose, product, initialDirection = 'buy', onSuccess }: OptionsTradeSheetProps) {
  const [amount, setAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DURATION_OPTIONS[0]);
  const [direction, setDirection] = useState<'buy' | 'sell'>(initialDirection);
  const [isLoading, setIsLoading] = useState(false);
  const [hasActiveTrade, setHasActiveTrade] = useState(false);
  const [checkingActiveTrade, setCheckingActiveTrade] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { balance, isLoading: balanceLoading, refetch: refetchBalance } = useExternalBalance(user?.id);

  const price = product.price || 0;
  const amountNum = parseFloat(amount) || 0;
  const currentMinAmount = selectedDuration.minAmount;
  const estimatedProfit = amountNum * selectedDuration.profitRate;
  const priceEquivalent = amountNum > 0 && price > 0 ? (amountNum / price).toFixed(4) : '0';

  // Check for active trades
  const checkActiveTrade = useCallback(async () => {
    if (!user) return;
    setCheckingActiveTrade(true);
    
    const { count, error } = await supabase
      .from('option_trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active');
    
    if (!error) {
      setHasActiveTrade((count || 0) > 0);
    }
    setCheckingActiveTrade(false);
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      refetchBalance();
      checkActiveTrade();
    }
  }, [isOpen, user, refetchBalance, checkActiveTrade]);

  // Sync direction when sheet opens with new initialDirection
  useEffect(() => {
    if (isOpen) {
      setDirection(initialDirection);
    }
  }, [isOpen, initialDirection]);

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setSelectedDuration(DURATION_OPTIONS[0]);
      setShowSuccessDialog(false);
    }
  }, [isOpen]);

  // Countdown timer for success dialog
  useEffect(() => {
    if (!showSuccessDialog || countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [showSuccessDialog, countdown]);

  const handleTrade = async () => {
    if (!user) {
      toast({ title: t('options.pleaseLogin'), variant: 'destructive' });
      return;
    }

    // Re-check for active trades before processing
    const { count } = await supabase
      .from('option_trades')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active');

    if ((count || 0) > 0) {
      toast({ 
        title: t('options.pendingOrder'), 
        variant: 'destructive' 
      });
      setHasActiveTrade(true);
      return;
    }

    if (amountNum < currentMinAmount) {
      toast({ 
        title: t('options.invalidAmount'), 
        description: t('options.minimumFor', { duration: selectedDuration.label, amount: currentMinAmount.toLocaleString() }),
        variant: 'destructive' 
      });
      return;
    }

    if (balance !== null && amountNum > balance) {
      toast({ 
        title: t('options.insufficientBalance'), 
        description: t('options.needAmount', { need: amountNum.toLocaleString(), have: balance.toLocaleString() }),
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
        _loss_rate: selectedDuration.lossRate,
        _entry_price: price > 0 ? price : undefined,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; trade_id?: string };

      if (!result.success) {
        toast({
          title: t('options.error'),
          description: result.error || t('options.cannotPlaceOrder'),
          variant: 'destructive',
        });
        return;
      }

      // Show success dialog with countdown
      setCountdown(selectedDuration.seconds);
      setShowSuccessDialog(true);
      
      onSuccess?.();
    } catch (error) {
      console.error('Option trade error:', error);
      toast({
        title: t('options.error'),
        description: t('options.cannotExecuteTrade'),
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

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    onClose();
  };

  const handleContinue = () => {
    setShowSuccessDialog(false);
    // Keep sheet open for next trade - just reset form
    setAmount('');
    setHasActiveTrade(true); // Mark as having active trade
  };

  return (
    <>
      <Sheet open={isOpen && !showSuccessDialog} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-3xl safe-area-padding-bottom">
          <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
            <SheetTitle className="text-lg">{t('options.limitedTime')}</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 touch-action-manipulation">
              <X className="h-5 w-5" />
            </Button>
          </SheetHeader>

          <div className="space-y-5 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* Product Info */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('options.productName')}</span>
              <span className="font-semibold">{product.symbol || product.name}</span>
            </div>

            {/* Buy/Sell Toggle and Price */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('options.buyingAmount')}</span>
                <span className="text-muted-foreground/70">${amountNum.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "font-medium",
                  direction === 'buy' ? "text-green-500" : "text-red-500"
                )}>
                  {direction === 'buy' ? t('options.buyUp') : t('options.buyDown')}
                </span>
                <span className={cn(
                  "font-bold text-lg",
                  direction === 'buy' ? "text-green-500" : "text-red-500"
                )}>
                  {price.toFixed(3)}
                </span>
              </div>
            </div>

            {/* Balance and Fee */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('options.availableBalance')}</span>
                <span className="font-semibold text-primary">
                  {balanceLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    formatCurrency(balance || 0)
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('options.handlingFee')}</span>
                <span className="font-medium">{(FEE_RATE * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Active Trade Warning */}
            {hasActiveTrade && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-sm">
                {t('options.pendingOrder')}
              </div>
            )}

            {/* Duration Options - Mobile optimized with larger touch targets */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t('options.deliveryTime')}</span>
              </div>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.seconds}
                    onClick={() => setSelectedDuration(opt)}
                    className={cn(
                      "flex-1 py-4 px-2 rounded-lg transition-all min-h-[64px] touch-action-manipulation",
                      selectedDuration.seconds === opt.seconds
                        ? "bg-cyan-500/20 border-2 border-cyan-500"
                        : "bg-muted/50 border-2 border-transparent hover:border-muted-foreground/30 active:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-center gap-1 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      {opt.label}
                    </div>
                    <div className={cn(
                      "text-xs mt-1",
                      selectedDuration.seconds === opt.seconds 
                        ? "text-cyan-400" 
                        : "text-muted-foreground"
                    )}>
                      {t('options.profitability')} {(opt.profitRate * 100).toFixed(0)}%
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input - Mobile optimized */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('options.buyingAmount')}</span>
                <span className="text-muted-foreground">{t('options.minimum')}: {currentMinAmount.toLocaleString()}</span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min={MIN_AMOUNT}
                  className="pl-8 h-14 text-lg font-medium bg-muted/50 touch-action-manipulation"
                />
              </div>
            </div>

            {/* Quick Amount Buttons - Mobile optimized */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {QUICK_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "flex-1 min-w-[64px] min-h-[44px] rounded-lg touch-action-manipulation",
                    amountNum === amt && "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                  )}
                  onClick={() => setAmount(String(amt))}
                >
                  {amt.toLocaleString()}
                </Button>
              ))}
            </div>

            {/* Estimated Profit */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-500 font-medium">
                {t('options.estimatedRevenue')}: {formatCurrency(estimatedProfit)}
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                {t('options.occupiedMargin')}: {priceEquivalent}
              </span>
            </div>

            {/* Submit Button - Large touch target */}
            <Button
              size="lg"
              className={cn(
                "w-full min-h-[56px] h-14 text-lg font-semibold rounded-xl touch-action-manipulation",
                direction === 'buy'
                  ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
                  : "bg-red-600 hover:bg-red-700 active:bg-red-800"
              )}
              disabled={isLoading || checkingActiveTrade || hasActiveTrade || amountNum < currentMinAmount || (balance !== null && amountNum > balance)}
              onClick={handleTrade}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              {direction === 'buy' ? t('options.buyNow') : t('options.sellNow')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Success Dialog with Countdown */}
      <Dialog open={showSuccessDialog} onOpenChange={handleCloseSuccessDialog}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl">
          <div className="flex flex-col items-center py-6 space-y-6">
            {/* Product Symbol */}
            <h2 className="text-xl font-semibold">{product.symbol || product.name}</h2>
            
            {/* Countdown Circle */}
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted/30"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-green-500"
                  strokeLinecap="round"
                  strokeDasharray={440}
                  strokeDashoffset={440 - (440 * countdown) / selectedDuration.seconds}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold text-green-500">{countdown}</span>
              </div>
            </div>

            {/* Action Buttons - Mobile optimized */}
            <div className="flex gap-4 w-full">
              <Button
                variant="outline"
                className="flex-1 min-h-[48px] h-12 rounded-xl bg-muted/50 touch-action-manipulation"
                onClick={handleCloseSuccessDialog}
              >
                {t('common.close')}
              </Button>
              <Button
                className="flex-1 min-h-[48px] h-12 rounded-xl bg-green-600 hover:bg-green-700 touch-action-manipulation"
                onClick={handleContinue}
              >
                {t('options.continue')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Toast Banner */}
      {showSuccessDialog && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full bg-muted/90 backdrop-blur-sm border border-border flex items-center gap-3 safe-area-margin-top">
          <span className="text-sm font-medium">{t('options.successfulPurchase')}</span>
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
      )}
    </>
  );
}