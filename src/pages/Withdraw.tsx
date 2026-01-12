import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, AlertCircle, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Vui lòng đăng nhập để rút tiền");
      navigate("/auth");
      return;
    }

    const withdrawAmount = parseFloat(amount);

    if (!amount || withdrawAmount <= 0) {
      toast.error("Vui lòng nhập số tiền hợp lệ");
      return;
    }

    if (withdrawAmount > balance) {
      toast.error("Số dư không đủ");
      return;
    }

    if (withdrawAmount < 10) {
      toast.error("Số tiền rút tối thiểu là 10 USDT");
      return;
    }

    if (!walletAddress.trim()) {
      toast.error("Vui lòng nhập địa chỉ ví nhận");
      return;
    }

    // Basic wallet address validation
    if (network === "trc20" && !walletAddress.startsWith("T")) {
      toast.error("Địa chỉ ví TRC20 không hợp lệ");
      return;
    }

    if ((network === "bep20" || network === "erc20") && !walletAddress.startsWith("0x")) {
      toast.error("Địa chỉ ví không hợp lệ");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount: withdrawAmount,
      network: network,
      wallet_address: walletAddress.trim(),
      status: "pending",
    });

    setLoading(false);

    if (error) {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại");
      console.error(error);
      return;
    }

    toast.success("Yêu cầu rút tiền đã được gửi thành công!");
    navigate("/profile");
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
          <h1 className="text-xl font-bold">Rút tiền</h1>
        </div>

        {/* Balance Card */}
        <Card className="bg-gradient-to-r from-primary/20 to-primary/5 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Số dư khả dụng</p>
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
              Chọn mạng lưới
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
            <CardTitle className="text-base">Thông tin rút tiền</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Địa chỉ ví nhận</Label>
              <Input
                placeholder="Nhập địa chỉ ví của bạn"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="bg-muted/50 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Số tiền rút (USDT)</Label>
              <Input
                type="number"
                placeholder="Tối thiểu 10 USDT"
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
                  Tất cả
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Info */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Số tiền rút</span>
              <span>{amount || "0"} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Phí rút</span>
              <span>1 USDT</span>
            </div>
            <div className="flex justify-between text-sm font-medium pt-2 border-t border-border/50">
              <span>Thực nhận</span>
              <span className="text-primary">
                {amount ? Math.max(0, parseFloat(amount) - 1).toFixed(2) : "0"} USDT
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
          <div className="text-xs text-yellow-500 space-y-1">
            <p>• Thời gian xử lý: 1-24 giờ làm việc</p>
            <p>• Kiểm tra kỹ địa chỉ ví trước khi rút</p>
            <p>• Rút sai mạng sẽ mất tiền vĩnh viễn</p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {loading ? "Đang xử lý..." : "Xác nhận rút tiền"}
        </Button>
      </div>
    </Layout>
  );
};

export default Withdraw;
