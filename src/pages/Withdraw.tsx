import { useState, useEffect } from "react";
import { ArrowLeft, Menu, ChevronDown, Eye, EyeOff, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { balance: externalBalance, frozen: frozenBalance, isLoading: balanceLoading, refetch: refetchBalance } = useExternalBalance(user?.id);
  const { formatCurrency, convertCurrency, exchangeRates } = useCurrency();
  const { t } = useLanguage();
  
  const [amount, setAmount] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feeRate = 0.3; // 0.3%
  const minWithdraw = 10;
  
  // Use external balance, fallback to 0
  const availableBalance = externalBalance ?? 0;
  const maxWithdraw = availableBalance;
  
  // Calculate fee based on amount
  const amountNum = parseFloat(amount) || 0;
  const fee = amountNum * (feeRate / 100);
  const netAmount = amountNum - fee;

  // Convert to VND for display
  const balanceInVnd = convertCurrency(availableBalance, 'USD', 'VND');
  const feeInVnd = convertCurrency(fee, 'USD', 'VND');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const handleSetMaxAmount = () => {
    setAmount(availableBalance.toString());
  };

  const handleWithdraw = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    if (!amount || parseFloat(amount) < minWithdraw) {
      toast.error(`Số tiền rút tối thiểu là ${minWithdraw} USD`);
      return;
    }

    if (parseFloat(amount) > availableBalance) {
      toast.error("Số dư không đủ");
      return;
    }

    if (!address.trim()) {
      toast.error("Vui lòng nhập địa chỉ ví");
      return;
    }

    if (!password.trim()) {
      toast.error("Vui lòng nhập mật khẩu rút tiền");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create withdrawal transaction request
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'withdraw',
        amount: parseFloat(amount),
        status: 'pending',
        wallet_address: address,
        notes: `Withdrawal request - Fee: ${fee.toFixed(2)} USD (${feeRate}%)`,
      });

      if (error) throw error;

      toast.success("Yêu cầu rút tiền đã được gửi");
      
      // Reset form
      setAmount("");
      setAddress("");
      setPassword("");
      
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

        {/* Country Select */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Quốc gia</Label>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full bg-transparent border-0 text-muted-foreground h-auto p-0 focus:ring-0">
              <SelectValue placeholder="Vui lòng chọn một quốc gia" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="vn">Vietnam</SelectItem>
              <SelectItem value="us">United States</SelectItem>
              <SelectItem value="jp">Japan</SelectItem>
              <SelectItem value="kr">South Korea</SelectItem>
              <SelectItem value="th">Thailand</SelectItem>
              <SelectItem value="sg">Singapore</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Currency Select */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Tiền tệ</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full bg-transparent border-0 text-muted-foreground h-auto p-0 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="USD">USD - US Dollar</SelectItem>
              <SelectItem value="VND">VND - Vietnamese Dong</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Address Input */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Địa chỉ ví</Label>
          <Input
            type="text"
            placeholder="Nhập địa chỉ ví của bạn"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground h-auto p-0 focus-visible:ring-0"
          />
        </div>

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
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-foreground">{fee.toFixed(2)} USD</span>
              <span className="text-sm text-muted-foreground">≈ {feeInVnd.toLocaleString('vi-VN')} VND</span>
            </div>
            <div className="text-sm text-muted-foreground">Tỷ lệ phí: {feeRate}%</div>
            {amountNum > 0 && (
              <div className="text-sm text-green-500">
                Số tiền nhận được: {netAmount.toFixed(2)} USD
              </div>
            )}
          </div>
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
