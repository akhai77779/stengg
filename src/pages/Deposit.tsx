import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Wallet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";

const networks = [
  { id: "bep20", name: "BNB Smart Chain (BEP20)", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f1dE61" },
  { id: "trc20", name: "Tron (TRC20)", address: "TN8sfEoGhFkJaAMjTmYxTnhBBfzkcLPfPX" },
  { id: "erc20", name: "Ethereum (ERC20)", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f1dE61" },
];

const Deposit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [network, setNetwork] = useState(networks[0].id);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedNetwork = networks.find((n) => n.id === network);

  const copyAddress = () => {
    if (selectedNetwork) {
      navigator.clipboard.writeText(selectedNetwork.address);
      setCopied(true);
      toast.success(t('deposit.addressCopied'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('deposit.loginRequired'));
      navigate("/auth");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t('deposit.invalidAmount'));
      return;
    }

    if (!txHash.trim()) {
      toast.error(t('deposit.txHashRequired'));
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount: parseFloat(amount),
      network: network,
      tx_hash: txHash.trim(),
      wallet_address: selectedNetwork?.address,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      toast.error(t('common.error'));
      console.error(error);
      return;
    }

    toast.success(t('deposit.success'));
    navigate("/profile");
  };

  return (
    <Layout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('deposit.title')}</h1>
        </div>

        {/* Network Selection */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {t('deposit.selectNetwork')}
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

        {/* Wallet Address */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('deposit.walletAddress')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-muted/50 rounded-lg text-sm break-all font-mono">
                {selectedNetwork?.address}
              </div>
              <Button variant="outline" size="icon" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
              <p className="text-xs text-yellow-500">
                {t('deposit.warning').replace('{network}', selectedNetwork?.name || '')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Amount & TX Hash */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('deposit.transactionInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('deposit.amount')}</Label>
              <Input
                type="number"
                placeholder={t('deposit.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('deposit.txHash')}</Label>
              <Input
                placeholder={t('deposit.txHashPlaceholder')}
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="bg-muted/50"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {loading ? t('common.processing') : t('deposit.confirm')}
        </Button>
      </div>
    </Layout>
  );
};

export default Deposit;