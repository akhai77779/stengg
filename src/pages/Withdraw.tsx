import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";

const networks = [
  { id: "bep20", name: "BNB Smart Chain (BEP20)" },
  { id: "trc20", name: "Tron (TRC20)" },
  { id: "erc20", name: "Ethereum (ERC20)" },
];

const Withdraw = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const [network, setNetwork] = useState(networks[0].id);
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .maybeSingle();
    
    if (data) {
      setBalance(data.balance || 0);
    }
  };

  // Enhanced client-side validation (server validates again)
  const isValidWalletAddress = (address: string, net: string): boolean => {
    if (!address || !net) return false;
    
    if (net === 'trc20') {
      // TRC20: starts with T, 34 chars, base58
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    }
    if (net === 'bep20' || net === 'erc20') {
      // ERC20/BEP20: 0x + 40 hex chars
      return /^0x[0-9a-fA-F]{40}$/.test(address);
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('withdraw.loginRequired'));
      navigate("/auth");
      return;
    }

    const withdrawAmount = parseFloat(amount);

    if (!amount || withdrawAmount <= 0) {
      toast.error(t('withdraw.invalidAmount'));
      return;
    }

    if (withdrawAmount < 10) {
      toast.error(t('withdraw.minAmount'));
      return;
    }

    const fee = withdrawAmount * 0.01;
    const totalDeduction = withdrawAmount + fee;

    if (totalDeduction > balance) {
      toast.error(t('withdraw.insufficientBalance'));
      return;
    }

    if (!walletAddress.trim()) {
      toast.error(t('withdraw.walletRequired'));
      return;
    }

    // Enhanced client-side validation
    if (!isValidWalletAddress(walletAddress.trim(), network)) {
      if (network === "trc20") {
        toast.error(t('withdraw.invalidTRC20'));
      } else {
        toast.error(t('withdraw.invalidERC20'));
      }
      return;
    }

    setLoading(true);

    try {
      // Use secure server-side RPC function for withdrawal validation
      const { data, error } = await supabase.rpc('create_withdrawal_request', {
        _user_id: user.id,
        _amount: withdrawAmount,
        _network: network,
        _wallet_address: walletAddress.trim(),
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        toast.error(result.error || t('common.error'));
        setLoading(false);
        return;
      }

      toast.success(t('withdraw.success'));
      navigate("/profile");
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast.error(t('common.error'));
    }

    setLoading(false);
  };

  const quickAmounts = [50, 100, 500, 1000];

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('withdraw.title')}</h1>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('withdraw.availableBalance')}</p>
                <p className="text-2xl font-bold text-primary">${balance.toFixed(2)}</p>
              </div>
              <Wallet className="h-10 w-10 text-primary/50" />
            </div>
          </CardContent>
        </Card>

        {/* Network Selection */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {t('withdraw.selectNetwork')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger className="bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {networks.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Withdrawal Info */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('withdraw.info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('withdraw.walletAddress')}</Label>
              <Input
                placeholder={t('withdraw.walletPlaceholder')}
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('withdraw.amount')}</Label>
              <Input
                type="number"
                placeholder={t('withdraw.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted/50"
              />
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((qa) => (
                  <Button
                    key={qa}
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(qa.toString())}
                    disabled={qa > balance}
                    className="text-xs"
                  >
                    ${qa}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(balance.toString())}
                  className="text-xs"
                >
                  {t('common.all')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Info */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('withdraw.withdrawAmount')}</span>
              <span>{amount || "0"} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('withdraw.fee')}</span>
              <span>{amount ? (parseFloat(amount) * 0.01).toFixed(2) : "0"} USDT</span>
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-border/50">
              <span>{t('withdraw.actualReceive')}</span>
              <span className="text-primary">
                {amount ? (parseFloat(amount) * 0.99).toFixed(2) : "0"} USDT
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
          <div className="text-xs text-yellow-500 space-y-1">
            <p>• {t('withdraw.warning1')}</p>
            <p>• {t('withdraw.warning2')}</p>
            <p>• {t('withdraw.warning3')}</p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {loading ? t('common.processing') : t('withdraw.confirm')}
        </Button>
      </div>
    </Layout>
  );
};

export default Withdraw;