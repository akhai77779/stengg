import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, Wallet, QrCode, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useDepositSettings, BankConfig, CryptoConfig, QRConfig, CryptoWallet } from "@/hooks/useDepositSettings";

const Deposit = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { settings, isLoading } = useDepositSettings();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Đã sao chép!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Không thể sao chép");
    }
  };

  const bankSetting = settings.find(s => s.method_type === 'bank' && s.is_active);
  const cryptoSetting = settings.find(s => s.method_type === 'crypto' && s.is_active);
  const qrSetting = settings.find(s => s.method_type === 'qr' && s.is_active);

  const bankConfig = bankSetting?.config as BankConfig | undefined;
  const cryptoConfig = cryptoSetting?.config as CryptoConfig | undefined;
  const qrConfig = qrSetting?.config as QRConfig | undefined;

  const activeTabs = [
    bankSetting && 'bank',
    cryptoSetting && 'crypto',
    qrSetting && 'qr',
  ].filter(Boolean) as string[];

  const defaultTab = activeTabs[0] || 'bank';

  if (isLoading) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (activeTabs.length === 0) {
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
              <h1 className="text-lg md:text-xl font-bold text-foreground">Nạp tiền</h1>
            </div>
            <Card className="bg-card border-border">
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  Chưa có phương thức nạp tiền nào được kích hoạt. Vui lòng liên hệ hỗ trợ.
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
            <h1 className="text-lg md:text-xl font-bold text-foreground">Nạp tiền</h1>
          </div>

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${activeTabs.length}, 1fr)` }}>
              {bankSetting && (
                <TabsTrigger value="bank" className="gap-2">
                  <Banknote className="h-4 w-4" />
                  <span className="hidden sm:inline">Ngân hàng</span>
                </TabsTrigger>
              )}
              {cryptoSetting && (
                <TabsTrigger value="crypto" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">Crypto</span>
                </TabsTrigger>
              )}
              {qrSetting && (
                <TabsTrigger value="qr" className="gap-2">
                  <QrCode className="h-4 w-4" />
                  <span className="hidden sm:inline">QR Code</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Bank Transfer Tab */}
            {bankSetting && bankConfig && (
              <TabsContent value="bank" className="mt-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Banknote className="h-5 w-5 text-primary" />
                      Chuyển khoản ngân hàng
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Chuyển khoản đến tài khoản bên dưới và liên hệ Support để xác nhận nạp tiền.
                    </p>

                    <div className="space-y-3">
                      <InfoRow
                        label="Ngân hàng"
                        value={bankConfig.bank_name}
                        onCopy={() => copyToClipboard(bankConfig.bank_name, 'bank_name')}
                        copied={copiedField === 'bank_name'}
                      />
                      <InfoRow
                        label="Số tài khoản"
                        value={bankConfig.account_number}
                        onCopy={() => copyToClipboard(bankConfig.account_number, 'account_number')}
                        copied={copiedField === 'account_number'}
                        highlight
                      />
                      <InfoRow
                        label="Chủ tài khoản"
                        value={bankConfig.account_holder}
                        onCopy={() => copyToClipboard(bankConfig.account_holder, 'account_holder')}
                        copied={copiedField === 'account_holder'}
                      />
                      {bankConfig.branch && (
                        <InfoRow
                          label="Chi nhánh"
                          value={bankConfig.branch}
                          onCopy={() => copyToClipboard(bankConfig.branch!, 'branch')}
                          copied={copiedField === 'branch'}
                        />
                      )}
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                      <p>⚠️ Nội dung chuyển khoản ghi: <strong>Mã user + Số điện thoại</strong></p>
                      <p>⚠️ Sau khi chuyển khoản, vui lòng liên hệ Support để xác nhận</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Crypto Tab */}
            {cryptoSetting && cryptoConfig && (
              <TabsContent value="crypto" className="mt-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      Nạp qua Crypto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Chuyển USDT đến một trong các địa chỉ ví bên dưới.
                    </p>

                    {cryptoConfig.wallets && cryptoConfig.wallets.length > 0 ? (
                      <div className="space-y-4">
                        {cryptoConfig.wallets.map((wallet: CryptoWallet, index: number) => (
                          wallet.address && (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">{wallet.network}</Badge>
                                <span className="text-sm text-muted-foreground">{wallet.currency}</span>
                              </div>
                              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3">
                                <code className="text-xs flex-1 break-all font-mono">{wallet.address}</code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 flex-shrink-0"
                                  onClick={() => copyToClipboard(wallet.address, `wallet_${index}`)}
                                >
                                  {copiedField === `wallet_${index}` ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Chưa có địa chỉ ví nào được cấu hình
                      </p>
                    )}

                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                      <p>⚠️ Chỉ gửi USDT đến đúng mạng lưới tương ứng</p>
                      <p>⚠️ Gửi nhầm mạng có thể mất tiền vĩnh viễn</p>
                      <p>⚠️ Sau khi gửi, liên hệ Support với TxHash để xác nhận</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* QR Code Tab */}
            {qrSetting && qrConfig && (
              <TabsContent value="qr" className="mt-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-primary" />
                      Quét mã QR
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Quét mã QR bên dưới để chuyển khoản nhanh.
                    </p>

                    {qrConfig.qr_image_url ? (
                      <div className="flex justify-center">
                        <div className="bg-white p-4 rounded-lg">
                          <img
                            src={qrConfig.qr_image_url}
                            alt="QR Code thanh toán"
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center py-8">
                        <p className="text-sm text-muted-foreground">Chưa có mã QR</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <InfoRow
                        label="Ngân hàng"
                        value={qrConfig.bank_name}
                        onCopy={() => copyToClipboard(qrConfig.bank_name, 'qr_bank_name')}
                        copied={copiedField === 'qr_bank_name'}
                      />
                      <InfoRow
                        label="Số tài khoản"
                        value={qrConfig.account_number}
                        onCopy={() => copyToClipboard(qrConfig.account_number, 'qr_account_number')}
                        copied={copiedField === 'qr_account_number'}
                        highlight
                      />
                      <InfoRow
                        label="Chủ tài khoản"
                        value={qrConfig.account_holder}
                        onCopy={() => copyToClipboard(qrConfig.account_holder, 'qr_account_holder')}
                        copied={copiedField === 'qr_account_holder'}
                      />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                      <p>⚠️ Nội dung chuyển khoản ghi: <strong>Mã user + Số điện thoại</strong></p>
                      <p>⚠️ Sau khi chuyển khoản, vui lòng liên hệ Support để xác nhận</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  highlight?: boolean;
}

const InfoRow = ({ label, value, onCopy, copied, highlight }: InfoRowProps) => (
  <div className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium truncate ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 flex-shrink-0"
      onClick={onCopy}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  </div>
);

export default Deposit;
