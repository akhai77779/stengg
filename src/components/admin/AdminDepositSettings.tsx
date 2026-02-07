import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Banknote, Wallet, QrCode, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useDepositSettings, BankConfig, CryptoConfig, QRConfig, CryptoWallet } from "@/hooks/useDepositSettings";
import { supabase } from "@/integrations/supabase/client";

export function AdminDepositSettings() {
  const { settings, isLoading, updateSetting, refetch } = useDepositSettings();
  const [saving, setSaving] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Local state for editing
  const [bankForm, setBankForm] = useState<BankConfig | null>(null);
  const [cryptoForm, setCryptoForm] = useState<CryptoConfig | null>(null);
  const [qrForm, setQrForm] = useState<QRConfig | null>(null);

  // Initialize forms from settings
  const bankSetting = settings.find(s => s.method_type === 'bank');
  const cryptoSetting = settings.find(s => s.method_type === 'crypto');
  const qrSetting = settings.find(s => s.method_type === 'qr');

  const currentBankConfig = (bankForm ?? bankSetting?.config) as BankConfig | undefined;
  const currentCryptoConfig = (cryptoForm ?? cryptoSetting?.config) as CryptoConfig | undefined;
  const currentQrConfig = (qrForm ?? qrSetting?.config) as QRConfig | undefined;

  const handleSaveBank = async () => {
    if (!currentBankConfig) return;
    setSaving('bank');
    await updateSetting('bank', { config: currentBankConfig as never });
    setBankForm(null);
    setSaving(null);
  };

  const handleSaveCrypto = async () => {
    if (!currentCryptoConfig) return;
    setSaving('crypto');
    await updateSetting('crypto', { config: currentCryptoConfig as never });
    setCryptoForm(null);
    setSaving(null);
  };

  const handleSaveQr = async () => {
    if (!currentQrConfig) return;
    setSaving('qr');
    await updateSetting('qr', { config: currentQrConfig as never });
    setQrForm(null);
    setSaving(null);
  };

  const handleToggleActive = async (methodType: string, isActive: boolean) => {
    await updateSetting(methodType, { is_active: isActive });
  };

  const handleUploadQR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `qr-deposit-${Date.now()}.${fileExt}`;
      const filePath = `deposit/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      setQrForm(prev => ({
        ...((prev ?? currentQrConfig) as QRConfig),
        qr_image_url: publicUrl,
      }));

      toast.success('Upload QR thành công!');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const addCryptoWallet = () => {
    const current = currentCryptoConfig ?? { wallets: [] };
    setCryptoForm({
      ...current,
      wallets: [...(current.wallets || []), { network: 'TRC20', address: '', currency: 'USDT' }],
    });
  };

  const removeCryptoWallet = (index: number) => {
    const current = currentCryptoConfig ?? { wallets: [] };
    setCryptoForm({
      ...current,
      wallets: current.wallets.filter((_, i) => i !== index),
    });
  };

  const updateCryptoWallet = (index: number, field: keyof CryptoWallet, value: string) => {
    const current = currentCryptoConfig ?? { wallets: [] };
    const newWallets = [...current.wallets];
    newWallets[index] = { ...newWallets[index], [field]: value };
    setCryptoForm({ ...current, wallets: newWallets });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Banknote className="h-5 w-5" />
          Cấu hình nạp tiền
        </CardTitle>
        <CardDescription>
          Quản lý các phương thức nạp tiền hiển thị cho người dùng
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bank" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bank" className="gap-2">
              <Banknote className="h-4 w-4" />
              Ngân hàng
            </TabsTrigger>
            <TabsTrigger value="crypto" className="gap-2">
              <Wallet className="h-4 w-4" />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="qr" className="gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </TabsTrigger>
          </TabsList>

          {/* Bank Tab */}
          <TabsContent value="bank" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bật chuyển khoản ngân hàng</Label>
                <p className="text-xs text-muted-foreground">Hiển thị tab ngân hàng cho người dùng</p>
              </div>
              <Switch
                checked={bankSetting?.is_active ?? false}
                onCheckedChange={(checked) => handleToggleActive('bank', checked)}
              />
            </div>

            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="bank_name">Tên ngân hàng</Label>
                <Input
                  id="bank_name"
                  value={currentBankConfig?.bank_name ?? ''}
                  onChange={(e) => setBankForm(prev => ({
                    ...((prev ?? currentBankConfig) as BankConfig),
                    bank_name: e.target.value,
                  }))}
                  placeholder="VD: ACB, Vietcombank, Techcombank..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank_bin">Mã BIN ngân hàng (VietQR)</Label>
                <Input
                  id="bank_bin"
                  value={currentBankConfig?.bank_bin ?? ''}
                  onChange={(e) => setBankForm(prev => ({
                    ...((prev ?? currentBankConfig) as BankConfig),
                    bank_bin: e.target.value,
                  }))}
                  placeholder="VD: 970416 (ACB), 970436 (VCB), 970407 (TCB)"
                />
                <p className="text-xs text-muted-foreground">
                  Tra cứu mã BIN tại <a href="https://www.vietqr.io/danh-sach-ngan-hang" target="_blank" rel="noopener noreferrer" className="text-primary underline">vietqr.io</a>
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account_number">Số tài khoản</Label>
                <Input
                  id="account_number"
                  value={currentBankConfig?.account_number ?? ''}
                  onChange={(e) => setBankForm(prev => ({
                    ...((prev ?? currentBankConfig) as BankConfig),
                    account_number: e.target.value,
                  }))}
                  placeholder="VD: 1234567890"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="account_holder">Chủ tài khoản</Label>
                <Input
                  id="account_holder"
                  value={currentBankConfig?.account_holder ?? ''}
                  onChange={(e) => setBankForm(prev => ({
                    ...((prev ?? currentBankConfig) as BankConfig),
                    account_holder: e.target.value,
                  }))}
                  placeholder="VD: NGUYEN VAN A (viết HOA, không dấu)"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branch">Chi nhánh (tuỳ chọn)</Label>
                <Input
                  id="branch"
                  value={currentBankConfig?.branch ?? ''}
                  onChange={(e) => setBankForm(prev => ({
                    ...((prev ?? currentBankConfig) as BankConfig),
                    branch: e.target.value,
                  }))}
                  placeholder="VD: Chi nhánh HCM"
                />
              </div>
            </div>

            <Button onClick={handleSaveBank} disabled={saving === 'bank'} className="w-full">
              {saving === 'bank' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lưu cấu hình ngân hàng
            </Button>
          </TabsContent>

          {/* Crypto Tab */}
          <TabsContent value="crypto" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bật nạp Crypto</Label>
                <p className="text-xs text-muted-foreground">Hiển thị tab crypto cho người dùng</p>
              </div>
              <Switch
                checked={cryptoSetting?.is_active ?? false}
                onCheckedChange={(checked) => handleToggleActive('crypto', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Danh sách ví</Label>
                <Button variant="outline" size="sm" onClick={addCryptoWallet}>
                  <Plus className="h-4 w-4 mr-1" />
                  Thêm ví
                </Button>
              </div>

              {(currentCryptoConfig?.wallets || []).map((wallet, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{wallet.network} - {wallet.currency}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeCryptoWallet(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Mạng lưới</Label>
                      <Input
                        value={wallet.network}
                        onChange={(e) => updateCryptoWallet(index, 'network', e.target.value)}
                        placeholder="TRC20, ERC20, BEP20..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Tiền tệ</Label>
                      <Input
                        value={wallet.currency}
                        onChange={(e) => updateCryptoWallet(index, 'currency', e.target.value)}
                        placeholder="USDT, USDC..."
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Địa chỉ ví</Label>
                    <Input
                      value={wallet.address}
                      onChange={(e) => updateCryptoWallet(index, 'address', e.target.value)}
                      placeholder="Nhập địa chỉ ví..."
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ))}

              {(!currentCryptoConfig?.wallets || currentCryptoConfig.wallets.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Chưa có ví nào. Nhấn "Thêm ví" để bắt đầu.
                </p>
              )}
            </div>

            <Button onClick={handleSaveCrypto} disabled={saving === 'crypto'} className="w-full">
              {saving === 'crypto' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lưu cấu hình Crypto
            </Button>
          </TabsContent>

          {/* QR Tab */}
          <TabsContent value="qr" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Bật QR Code</Label>
                <p className="text-xs text-muted-foreground">Hiển thị tab QR code cho người dùng</p>
              </div>
              <Switch
                checked={qrSetting?.is_active ?? false}
                onCheckedChange={(checked) => handleToggleActive('qr', checked)}
              />
            </div>

            <Separator />

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Mã QR</Label>
                <div className="flex items-center gap-4">
                  {currentQrConfig?.qr_image_url ? (
                    <div className="bg-white p-2 rounded-lg border">
                      <img
                        src={currentQrConfig.qr_image_url}
                        alt="QR Code"
                        className="w-24 h-24 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                      <QrCode className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Label htmlFor="qr-upload" className="cursor-pointer">
                      <div className="border-2 border-dashed rounded-lg p-4 hover:bg-muted/50 transition-colors text-center">
                        {uploading ? (
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Upload mã QR</p>
                          </>
                        )}
                      </div>
                    </Label>
                    <input
                      id="qr-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadQR}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="qr_bank_name">Tên ngân hàng</Label>
                <Input
                  id="qr_bank_name"
                  value={currentQrConfig?.bank_name ?? ''}
                  onChange={(e) => setQrForm(prev => ({
                    ...((prev ?? currentQrConfig) as QRConfig),
                    bank_name: e.target.value,
                  }))}
                  placeholder="VD: Vietcombank"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qr_account_number">Số tài khoản</Label>
                <Input
                  id="qr_account_number"
                  value={currentQrConfig?.account_number ?? ''}
                  onChange={(e) => setQrForm(prev => ({
                    ...((prev ?? currentQrConfig) as QRConfig),
                    account_number: e.target.value,
                  }))}
                  placeholder="VD: 1234567890"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qr_account_holder">Chủ tài khoản</Label>
                <Input
                  id="qr_account_holder"
                  value={currentQrConfig?.account_holder ?? ''}
                  onChange={(e) => setQrForm(prev => ({
                    ...((prev ?? currentQrConfig) as QRConfig),
                    account_holder: e.target.value,
                  }))}
                  placeholder="VD: NGUYEN VAN A"
                />
              </div>
            </div>

            <Button onClick={handleSaveQr} disabled={saving === 'qr'} className="w-full">
              {saving === 'qr' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Lưu cấu hình QR Code
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
