import { useState, useEffect } from "react";
import { ArrowLeft, History, Eye, EyeOff, Loader2, ChevronRight, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useExternalBalance } from "@/hooks/useExternalBalance";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TransactionHistory } from "@/components/profile/TransactionHistory";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  branch: string | null;
}

// Country options
const COUNTRIES = [
  { id: 'vn', name: 'Việt Nam' },
  { id: 'us', name: 'United States' },
  { id: 'sg', name: 'Singapore' },
  { id: 'jp', name: 'Japan' },
  { id: 'kr', name: 'Korea' },
  { id: 'cn', name: 'China' },
] as const;

// Currency options
const CURRENCIES = [
  { id: 'vnd', name: 'VND - Việt Nam Đồng' },
  { id: 'usd', name: 'USD - US Dollar' },
  { id: 'sgd', name: 'SGD - Singapore Dollar' },
  { id: 'jpy', name: 'JPY - Japanese Yen' },
  { id: 'krw', name: 'KRW - Korean Won' },
  { id: 'cny', name: 'CNY - Chinese Yuan' },
] as const;

export default function WithdrawPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { balance: externalBalance, frozen: frozenBalance, isLoading: balanceLoading, refetch: refetchBalance } = useExternalBalance(user?.id);
  const { convertCurrency } = useCurrency();
  const { t } = useLanguage();
  
  const [amount, setAmount] = useState("");
  const [country, setCountry] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  const [withdrawFeeRate, setWithdrawFeeRate] = useState(0.01); // Default 1%
  const [minWithdraw, setMinWithdraw] = useState(10);

  // Fetch withdraw settings from admin
  useEffect(() => {
    const fetchWithdrawSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'withdraw_settings')
          .maybeSingle();

        if (data?.value && typeof data.value === 'object') {
          const settings = data.value as { fee_rate?: number; min_amount?: number };
          if (settings.fee_rate !== undefined) {
            setWithdrawFeeRate(settings.fee_rate);
          }
          if (settings.min_amount !== undefined) {
            setMinWithdraw(settings.min_amount);
          }
        }
      } catch (error) {
        console.error('Error fetching withdraw settings:', error);
      }
    };

    fetchWithdrawSettings();
  }, []);
  
  // Use external balance, fallback to 0
  const availableBalance = externalBalance ?? 0;
  const maxWithdraw = availableBalance;

  // Calculate amounts
  const amountNum = parseFloat(amount) || 0;
  const totalDeduction = amountNum + (amountNum * withdrawFeeRate);
  const processingFee = amountNum * withdrawFeeRate;

  // Convert to VND for display
  const balanceInVnd = convertCurrency(availableBalance, 'USD', 'VND');

  // Handle selected bank account from BankAccounts page
  useEffect(() => {
    const state = location.state as { 
      selectedAccount?: BankAccount;
      savedCountry?: string;
      savedCurrency?: string;
    } | null;
    
    if (state) {
      // Restore country and currency first (they're always passed back)
      if (state.savedCountry) {
        setCountry(state.savedCountry);
      }
      if (state.savedCurrency) {
        setCurrency(state.savedCurrency);
      }
      // Then restore selected bank account if present
      if (state.selectedAccount) {
        setSelectedBankAccount(state.selectedAccount);
      }
      // Clear the state after a short delay to ensure React has processed the state updates
      setTimeout(() => {
        window.history.replaceState({}, document.title);
      }, 100);
    }
  }, [location.state]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Subscribe to realtime balance updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('withdraw-balance')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          refetchBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchBalance]);

  const handleSetMaxAmount = () => {
    // Account for 1% fee when setting max
    const maxAfterFee = availableBalance / 1.01;
    setAmount(Math.floor(maxAfterFee).toString());
  };

  const handleWithdraw = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    // Client-side validations
    if (!country) {
      toast.error("Vui lòng chọn quốc gia");
      return;
    }

    if (!currency) {
      toast.error("Vui lòng chọn tiền tệ");
      return;
    }

    if (!selectedBankAccount) {
      toast.error("Vui lòng chọn tài khoản ngân hàng");
      return;
    }

    if (!amount || parseFloat(amount) < minWithdraw) {
      toast.error(`Số tiền rút tối thiểu là ${minWithdraw} USD`);
      return;
    }

    if (totalDeduction > availableBalance) {
      toast.error(`Số dư không đủ (bao gồm phí ${(withdrawFeeRate * 100).toFixed(0)}%)`);
      return;
    }

    if (!password.trim()) {
      toast.error("Vui lòng nhập mật khẩu rút tiền");
      return;
    }

    if (password.length < 6) {
      toast.error("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    setIsSubmitting(true);

    try {
      // First, verify the withdrawal password via edge function
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('withdrawal-password', {
        body: {
          action: 'verify',
          currentPassword: password
        }
      });

      if (verifyError) {
        console.error("Password verification error:", verifyError);
        toast.error("Không thể xác thực mật khẩu rút tiền");
        return;
      }

      if (!verifyData?.success || !verifyData?.valid) {
        toast.error(verifyData?.error || "Mật khẩu rút tiền không đúng");
        return;
      }

      // Password verified, proceed with withdrawal request
      const { data, error } = await supabase.rpc('create_withdrawal_request', {
        _user_id: user.id,
        _amount: parseFloat(amount),
        _network: currency, // Use currency as network for now
        _wallet_address: `${selectedBankAccount.bank_name} - ${selectedBankAccount.account_number}`,
      });

      if (error) {
        console.error("Withdrawal RPC error:", error);
        toast.error(error.message || "Không thể gửi yêu cầu rút tiền");
        return;
      }

      // Type assertion for RPC response
      const result = data as { success: boolean; error?: string; amount?: number; fee?: number } | null;

      if (!result?.success) {
        toast.error(result?.error || "Yêu cầu rút tiền thất bại");
        return;
      }

      toast.success(`Yêu cầu rút ${result.amount} USD đã được gửi. Phí: ${result.fee} USD`);
      
      // Reset form
      setAmount("");
      setSelectedBankAccount(null);
      setPassword("");
      setCountry("");
      setCurrency("");
      
      // Refetch balance
      refetchBalance();
      
      // Navigate to transaction history
      navigate('/wallet-details');
    } catch (error) {
      console.error("Withdraw error:", error);
      toast.error("Không thể gửi yêu cầu rút tiền");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)} 
                className="text-foreground hover:bg-muted min-h-[44px] min-w-[44px]"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg md:text-xl font-bold text-foreground">Rút tiền</h1>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowTransactionHistory(!showTransactionHistory)} 
              className="text-foreground hover:bg-muted min-h-[44px] min-w-[44px]"
            >
              {showTransactionHistory ? <X className="h-5 w-5" /> : <History className="h-5 w-5" />}
            </Button>
          </div>

          {/* Transaction History Panel */}
          {showTransactionHistory && (
            <Card className="bg-card border-border mb-4 md:mb-6">
              <CardContent className="p-3 md:p-4">
                <TransactionHistory />
              </CardContent>
            </Card>
          )}

          {/* Content */}
          <div className="space-y-4">
            {/* Balance Card */}
            <Card className="bg-card border-border">
              <CardContent className="p-3 md:p-4">
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs md:text-sm text-muted-foreground">Số dư khả dụng:</span>
                    {balanceLoading ? (
                      <Skeleton className="h-6 w-24 inline-block" />
                    ) : (
                      <span className="text-base md:text-lg font-semibold text-primary">{availableBalance.toFixed(2)} USD</span>
                    )}
                  </div>
                  {balanceLoading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <div className="text-xs md:text-sm text-muted-foreground">
                      ≈ {balanceInVnd.toLocaleString('vi-VN')} VND
                    </div>
                  )}
                  {frozenBalance && frozenBalance > 0 && (
                    <div className="text-xs md:text-sm text-destructive">
                      Đã đóng băng: {frozenBalance.toFixed(2)} USD
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Country & Currency Select */}
            <Card className="bg-card border-border">
              <CardContent className="p-3 md:p-4 space-y-4">
                {/* Country Select */}
                <div>
                  <Label className="text-xs md:text-sm text-muted-foreground mb-2 block">Quốc gia</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="w-full bg-transparent border-b border-border rounded-none h-10 px-0 focus:ring-0 focus:border-primary text-sm">
                      <SelectValue placeholder="Vui lòng chọn một quốc gia" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Currency Select */}
                <div>
                  <Label className="text-xs md:text-sm text-muted-foreground mb-2 block">Tiền tệ</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full bg-transparent border-b border-border rounded-none h-10 px-0 focus:ring-0 focus:border-primary text-sm">
                      <SelectValue placeholder="Vui lòng chọn tiền tệ" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Bank Account Selection */}
            <button
              type="button"
              onClick={() => navigate('/bank-accounts', { state: { selectMode: true, savedCountry: country, savedCurrency: currency } })}
              className="w-full bg-card rounded-lg p-3 md:p-4 border border-border flex items-center justify-between hover:bg-muted/50 transition-colors min-h-[56px] touch-action-manipulation"
            >
              {selectedBankAccount ? (
                <div className="text-left space-y-1">
                  <div className="text-sm md:text-base text-foreground font-medium">{selectedBankAccount.bank_name}</div>
                  <div className="text-xs md:text-sm text-muted-foreground">
                    {selectedBankAccount.account_holder} - ****{selectedBankAccount.account_number.slice(-4)}
                  </div>
                </div>
              ) : (
                <span className="text-xs md:text-sm text-muted-foreground">
                  Vui lòng chọn tài khoản ngân hàng
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Amount & Fee Section - Combined */}
            <Card className="bg-card border-border">
              <CardContent className="p-3 md:p-4 space-y-4">
                {/* Amount Input */}
                <div>
                  <Label className="text-xs md:text-sm text-primary mb-2 block">Số lượng</Label>
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <Input
                      type="number"
                      placeholder="Vui lòng nhập số lượng"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground h-auto p-0 flex-1 focus-visible:ring-0 text-sm md:text-base"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm md:text-base text-foreground">USD</span>
                      <button 
                        onClick={handleSetMaxAmount}
                        className="text-primary text-xs md:text-sm font-medium hover:underline min-h-[44px] px-2"
                      >
                        tất cả
                      </button>
                    </div>
                  </div>
                  {/* USD input → VND equivalent (tỷ giá từ cài đặt) */}
                  {amountNum > 0 && (
                    <div className="text-right text-xs md:text-sm text-muted-foreground mt-1">
                      ≈ {convertCurrency(amountNum, 'USD', 'VND').toLocaleString('vi-VN')} VND
                    </div>
                  )}
                </div>

                {/* Min/Max Amounts */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Số tiền rút tiền tối thiểu</span>
                    <span className="text-foreground">{minWithdraw} USD</span>
                  </div>
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="text-muted-foreground">Số tiền rút tiền tối đa</span>
                    <span className="text-foreground">{maxWithdraw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                  </div>
                </div>

                {/* Processing Fee */}
                <div>
                  <Label className="text-xs md:text-sm text-primary mb-2 block">Phí xử lý</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm md:text-base text-foreground">{processingFee.toFixed(2)}</span>
                    {processingFee > 0 && (
                      <span className="text-xs md:text-sm text-muted-foreground">
                        ≈ {convertCurrency(processingFee, 'USD', 'VND').toLocaleString('vi-VN')} VND
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Password Input */}
            <Card className="bg-card border-border">
              <CardContent className="p-3 md:p-4">
                <Label className="text-xs md:text-sm text-foreground mb-2 block">Mật khẩu rút tiền</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Vui lòng nhập mật khẩu rút tiền của bạn"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground h-auto p-0 flex-1 focus-visible:ring-0 text-sm md:text-base"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-primary hover:bg-transparent h-auto w-auto p-0 min-h-[44px] min-w-[44px]"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

          {/* Submit Button */}
          <Button
            onClick={handleWithdraw}
            disabled={isSubmitting || balanceLoading || !amount || parseFloat(amount) < minWithdraw}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-lg min-h-[48px] text-sm md:text-base"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Rút tiền"
            )}
          </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
