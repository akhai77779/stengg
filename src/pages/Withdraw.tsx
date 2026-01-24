import { useState, useEffect } from "react";
import { ArrowLeft, Menu, Eye, EyeOff, Loader2, ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useExternalBalance } from "@/hooks/useExternalBalance";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const minWithdraw = 10;
  
  // Use external balance, fallback to 0
  const availableBalance = externalBalance ?? 0;
  const maxWithdraw = availableBalance;

  // Calculate amounts
  const amountNum = parseFloat(amount) || 0;
  const totalDeduction = amountNum + (amountNum * 0.01); // 1% fee from RPC
  const processingFee = amountNum * 0.01;

  // Convert to VND for display
  const balanceInVnd = convertCurrency(availableBalance, 'USD', 'VND');

  // Handle selected bank account from BankAccounts page
  useEffect(() => {
    const state = location.state as { selectedAccount?: BankAccount } | null;
    if (state?.selectedAccount) {
      setSelectedBankAccount(state.selectedAccount);
      // Clear the state to prevent re-applying on future navigations
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

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
      toast.error("Số dư không đủ (bao gồm phí 1%)");
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
      // Use secure RPC function for withdrawal
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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-foreground hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Rút tiền</h1>
        <Button variant="ghost" size="icon" className="text-foreground hover:bg-muted">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Balance Card */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">Số dư khả dụng:</span>
              {balanceLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <span className="text-lg font-semibold text-primary">{availableBalance.toFixed(2)} USD</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              ≈ {balanceInVnd.toLocaleString('vi-VN')} VND
            </div>
            {frozenBalance && frozenBalance > 0 && (
              <div className="text-sm text-destructive">
                Đã đóng băng: {frozenBalance.toFixed(2)} USD
              </div>
            )}
          </div>
        </div>

        {/* Country & Currency Select */}
        <div className="bg-card rounded-lg p-4 border border-border space-y-4">
          {/* Country Select */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">Quốc gia</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="w-full bg-transparent border-b border-border rounded-none h-10 px-0 focus:ring-0 focus:border-primary">
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
            <Label className="text-sm text-muted-foreground mb-2 block">Tiền tệ</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full bg-transparent border-b border-border rounded-none h-10 px-0 focus:ring-0 focus:border-primary">
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
        </div>

        {/* Bank Account Selection */}
        <button
          type="button"
          onClick={() => navigate('/bank-accounts', { state: { selectMode: true } })}
          className="w-full bg-card rounded-lg p-4 border border-border flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          {selectedBankAccount ? (
            <div className="text-left space-y-1">
              <div className="text-foreground font-medium">{selectedBankAccount.bank_name}</div>
              <div className="text-sm text-muted-foreground">
                {selectedBankAccount.account_holder} - ****{selectedBankAccount.account_number.slice(-4)}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">
              Vui lòng chọn tài khoản ngân hàng
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Amount Section */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Số lượng</Label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Input
                type="number"
                placeholder="Vui lòng nhập số lượng"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground h-auto p-0 flex-1 focus-visible:ring-0"
              />
              <div className="flex items-center gap-2">
                <span className="text-foreground">USD</span>
                <button 
                  onClick={handleSetMaxAmount}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  tất cả
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Số tiền rút tiền tối thiểu</span>
              <span className="text-foreground">{minWithdraw} USD</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Số tiền rút tiền tối đa</span>
              <span className="text-foreground">{maxWithdraw.toFixed(2)} USD</span>
            </div>
          </div>
        </div>

        {/* Fee Section */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Phí xử lý</Label>
          <div className="text-foreground">{processingFee.toFixed(2)}</div>
        </div>

        {/* Password Input */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Mật khẩu rút tiền</Label>
          <div className="flex items-center gap-2">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Vui lòng nhập mật khẩu rút tiền của bạn"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground h-auto p-0 flex-1 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="text-primary hover:bg-transparent h-auto w-auto p-0"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleWithdraw}
          disabled={isSubmitting || balanceLoading || !amount || parseFloat(amount) < minWithdraw}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 rounded-lg"
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
  );
}
