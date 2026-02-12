import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, QrCode, Copy, Check, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDepositSettings, BankConfig } from "@/hooks/useDepositSettings";

const Deposit = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { settings, isLoading: settingsLoading } = useDepositSettings();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Check if BankQuay auto-deposit is enabled
  const { data: bankquayEnabled, isLoading: bankquayLoading } = useQuery({
    queryKey: ["bankquay-enabled-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "bankquay_enabled")
        .maybeSingle();
      if (error) throw error;
      if (!data) return false;
      return (data.value as { enabled?: boolean })?.enabled ?? false;
    },
  });

  // Get bank config from settings
  const bankSetting = settings.find(s => s.method_type === 'bank' && s.is_active);
  const bankConfig = bankSetting?.config as BankConfig | undefined;

  const formatAmount = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmount(e.target.value);
    setAmount(formatted);
    if (qrUrl) setQrUrl(null);
  };

  const getNumericAmount = () => {
    return parseInt(amount.replace(/,/g, ""), 10) || 0;
  };

  const generateQR = async () => {
    const numericAmount = getNumericAmount();
    
    if (numericAmount < 10000) {
      toast.error("Số tiền tối thiểu là 10,000 VND");
      return;
    }

    if (!bankConfig?.bank_bin || !bankConfig?.account_number) {
      toast.error("Chưa cấu hình thông tin ngân hàng. Vui lòng liên hệ Admin.");
      return;
    }

    setLoading(true);
    try {
      // VietQR API - Free QR code generation
      const addInfo = `NAP${Date.now()}`; 
      const encodedName = encodeURIComponent(bankConfig.account_holder || "");
      const encodedInfo = encodeURIComponent(addInfo);
      
      const qrApiUrl = `https://img.vietqr.io/image/${bankConfig.bank_bin}-${bankConfig.account_number}-compact2.png?amount=${numericAmount}&addInfo=${encodedInfo}&accountName=${encodedName}`;
      
      setQrUrl(qrApiUrl);
      toast.success("Mã QR đã được tạo!");
    } catch (error) {
      console.error("Error generating QR:", error);
      toast.error("Không thể tạo mã QR. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(getNumericAmount().toString());
    setCopied(true);
    toast.success("Đã sao chép số tiền");
    setTimeout(() => setCopied(false), 2000);
  };

  const presetAmounts = [100000, 200000, 500000, 1000000, 2000000, 5000000];

  if (settingsLoading || bankquayLoading) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Show "Liên hệ CSKH" when BankQuay is disabled OR no bank config
  if (!bankquayEnabled || !bankConfig || !bankConfig.bank_bin || !bankConfig.account_number) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen pb-20 md:pb-8">
          <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="text-foreground hover:bg-muted min-h-[44px] min-w-[44px]"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg md:text-xl font-bold text-foreground">{t("deposit")}</h1>
            </div>
            <Card className="bg-card border-border">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Banknote className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">
                  Vui lòng liên hệ CSKH để được hỗ trợ nạp tiền
                </p>
                <p className="text-xs text-muted-foreground">
                  Liên hệ bộ phận chăm sóc khách hàng qua Live Chat để được hướng dẫn
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-foreground hover:bg-muted min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-foreground">{t("deposit")}</h1>
          </div>

          <Card className="border-border shadow-lg">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                <Banknote className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">{t("deposit")}</CardTitle>
              <CardDescription>
                Nhập số tiền và quét mã QR để nạp tiền
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Bank Info Display */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Ngân hàng nhận</p>
                <p className="font-medium">{bankConfig.bank_name}</p>
                <p className="text-sm text-muted-foreground">{bankConfig.account_number} - {bankConfig.account_holder}</p>
              </div>

              {/* Amount Input */}
              <div className="space-y-3">
                <Label htmlFor="amount" className="text-base font-medium">
                  Số tiền nạp (VND)
                </Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="Nhập số tiền..."
                    value={amount}
                    onChange={handleAmountChange}
                    className="text-lg font-semibold h-14 pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    VND
                  </span>
                </div>
                
                {/* Preset Amounts */}
                <div className="grid grid-cols-3 gap-2">
                  {presetAmounts.map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmount(formatAmount(preset.toString()))}
                      className="text-xs"
                    >
                      {preset.toLocaleString()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Generate QR Button */}
              <Button 
                onClick={generateQR} 
                disabled={loading || getNumericAmount() < 10000}
                className="w-full h-12 text-base font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Đang tạo mã QR...
                  </>
                ) : (
                  <>
                    <QrCode className="h-5 w-5 mr-2" />
                    Tạo mã QR
                  </>
                )}
              </Button>

              {/* QR Code Display */}
              {qrUrl && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Quét mã QR bên dưới để thanh toán
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl font-bold text-primary">
                        {amount} VND
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCopyAmount}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-xl shadow-inner border">
                      <img
                        src={qrUrl}
                        alt="QR Code thanh toán"
                        className="w-64 h-64 object-contain"
                        onError={() => {
                          toast.error("Không thể tải mã QR");
                          setQrUrl(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                      ⚠️ Vui lòng chuyển <strong>đúng số tiền</strong> để giao dịch được xử lý tự động
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Deposit;
