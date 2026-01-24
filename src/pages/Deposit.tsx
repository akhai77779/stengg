import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Wallet, AlertCircle, QrCode } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";

const NETWORKS = [
  { value: "trc20", label: "TRC20 (USDT)", fee: "1 USDT" },
  { value: "bep20", label: "BEP20 (USDT)", fee: "0.5 USDT" },
  { value: "erc20", label: "ERC20 (USDT)", fee: "5 USDT" },
];

// Platform wallet addresses for deposits
const PLATFORM_WALLETS = {
  trc20: "TYDzsYUEpvnYmQk4zGP9sWWcTEd2MiAtW7",
  bep20: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE03",
  erc20: "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE03",
};

const Deposit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [network, setNetwork] = useState("trc20");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedNetwork = NETWORKS.find(n => n.value === network);
  const walletAddress = PLATFORM_WALLETS[network as keyof typeof PLATFORM_WALLETS];

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      toast.success("Đã sao chép địa chỉ ví");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Không thể sao chép");
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập");
      return;
    }

    if (!amount || parseFloat(amount) < 10) {
      toast.error("Số tiền tối thiểu là $10");
      return;
    }

    if (!txHash.trim()) {
      toast.error("Vui lòng nhập mã giao dịch (TX Hash)");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "deposit",
        amount: parseFloat(amount),
        status: "pending",
        network: network,
        tx_hash: txHash.trim(),
        notes: `Nạp tiền qua ${selectedNetwork?.label}`,
      });

      if (error) throw error;

      toast.success("Yêu cầu nạp tiền đã được gửi! Chúng tôi sẽ xác nhận trong vòng 30 phút.");
      setAmount("");
      setTxHash("");
      navigate("/wallet-details");
    } catch (error: any) {
      console.error("Deposit error:", error);
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background p-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Nạp tiền</h1>
        </div>

        <div className="space-y-4 max-w-lg mx-auto">
          {/* Network Selection */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Chọn mạng lưới
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mạng" />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{n.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Phí: {n.fee}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Alert className="bg-primary/5 border-primary/20">
                <AlertCircle className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  Chỉ gửi <strong>USDT</strong> qua mạng <strong>{selectedNetwork?.label}</strong>. 
                  Gửi sai mạng có thể mất tiền vĩnh viễn.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Wallet Address */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" />
                Địa chỉ ví nhận
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs break-all font-mono text-foreground">
                    {walletAddress}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyAddress}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Quét mã QR hoặc sao chép địa chỉ trên để nạp tiền
              </div>
            </CardContent>
          </Card>

          {/* Amount & TX Hash */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Thông tin giao dịch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Số tiền (USDT)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Nhập số tiền"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="10"
                  className="bg-background/50"
                />
                <p className="text-xs text-muted-foreground">Tối thiểu: $10</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="txHash">Mã giao dịch (TX Hash)</Label>
                <Input
                  id="txHash"
                  type="text"
                  placeholder="Nhập TX Hash sau khi chuyển tiền"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="bg-background/50 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  TX Hash là mã xác nhận giao dịch từ blockchain
                </p>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !amount || !txHash}
                className="w-full bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? "Đang xử lý..." : "Xác nhận nạp tiền"}
              </Button>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hướng dẫn nạp tiền</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Chọn mạng lưới phù hợp (TRC20 phí thấp nhất)</li>
                <li>Sao chép địa chỉ ví nhận hoặc quét mã QR</li>
                <li>Chuyển USDT từ ví của bạn đến địa chỉ trên</li>
                <li>Nhập số tiền và mã TX Hash sau khi chuyển</li>
                <li>Nhấn "Xác nhận nạp tiền" và chờ xác nhận</li>
              </ol>
              <p className="mt-4 text-xs text-amber-500">
                ⚠️ Thời gian xác nhận: 5-30 phút tùy thuộc vào blockchain
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Deposit;
