import { useState, useEffect } from "react";
import { ArrowLeft, Menu, Eye, EyeOff, Loader2 } from "lucide-react";
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

// Network options with fees
const NETWORKS = [
  { id: 'trc20', name: 'TRC20 (USDT)', fee: 1 },
  { id: 'bep20', name: 'BEP20 (BSC)', fee: 0.5 },
  { id: 'erc20', name: 'ERC20 (ETH)', fee: 5 },
] as const;

export default function WithdrawPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { balance: externalBalance, frozen: frozenBalance, isLoading: balanceLoading, refetch: refetchBalance } = useExternalBalance(user?.id);
  const { convertCurrency } = useCurrency();
  const { t } = useLanguage();
  
  const [amount, setAmount] = useState("");
  const [network, setNetwork] = useState<string>("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minWithdraw = 10;
  
  // Use external balance, fallback to 0
  const availableBalance = externalBalance ?? 0;
  const maxWithdraw = availableBalance;
  
  // Get selected network fee
  const selectedNetwork = NETWORKS.find(n => n.id === network);
  const networkFee = selectedNetwork?.fee ?? 0;
  
  // Calculate amounts
  const amountNum = parseFloat(amount) || 0;
  const totalDeduction = amountNum + (amountNum * 0.01); // 1% fee from RPC
  const netAmount = amountNum - networkFee;

  // Convert to VND for display
  const balanceInVnd = convertCurrency(availableBalance, 'USD', 'VND');

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

  // Validate wallet address format
  const isValidAddress = (addr: string, net: string): boolean => {
    if (!addr || !net) return false;
    
    switch (net) {
      case 'trc20':
        return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr);
      case 'bep20':
      case 'erc20':
        return /^0x[0-9a-fA-F]{40}$/.test(addr);
      default:
        return false;
    }
  };

  const handleWithdraw = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    // Client-side validations
    if (!network) {
      toast.error("Vui lòng chọn mạng lưới");
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

    if (!address.trim()) {
      toast.error("Vui lòng nhập địa chỉ ví");
      return;
    }

    if (!isValidAddress(address.trim(), network)) {
      toast.error("Địa chỉ ví không hợp lệ cho mạng đã chọn");
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
        _network: network,
        _wallet_address: address.trim(),
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
      setAddress("");
      setPassword("");
      setNetwork("");
      
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

        {/* Network Select */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Mạng lưới</Label>
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger className="w-full bg-transparent border-0 text-muted-foreground h-auto p-0 focus:ring-0">
              <SelectValue placeholder="Chọn mạng lưới blockchain" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {NETWORKS.map((net) => (
                <SelectItem key={net.id} value={net.id}>
                  {net.name} - Phí: ${net.fee}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Address Input */}
        <div className="bg-card rounded-lg p-4 border border-border">
          <Label className="text-sm text-foreground mb-2 block">Địa chỉ ví {network.toUpperCase()}</Label>
          <Input
            type="text"
            placeholder={network === 'trc20' ? 'T...' : '0x...'}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="bg-transparent border-0 text-foreground placeholder:text-muted-foreground h-auto p-0 focus-visible:ring-0"
          />
          {address && network && !isValidAddress(address, network) && (
            <p className="text-destructive text-xs mt-2">Địa chỉ không hợp lệ cho mạng {network.toUpperCase()}</p>
          )}
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
          <Label className="text-sm text-foreground mb-2 block">Chi tiết phí</Label>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Phí xử lý (1%):</span>
              <span className="text-foreground">{(amountNum * 0.01).toFixed(2)} USD</span>
            </div>
            {networkFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phí mạng {network.toUpperCase()}:</span>
                <span className="text-foreground">{networkFee.toFixed(2)} USD</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-muted-foreground">Tổng trừ từ số dư:</span>
              <span className="font-semibold text-foreground">{totalDeduction.toFixed(2)} USD</span>
            </div>
            {amountNum > 0 && netAmount > 0 && (
              <div className="flex justify-between text-sm text-green-500">
                <span>Số tiền nhận được:</span>
                <span className="font-semibold">{netAmount.toFixed(2)} USD</span>
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
