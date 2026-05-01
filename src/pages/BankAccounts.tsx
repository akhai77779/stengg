import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, Plus, Loader2, ShieldAlert, Check, ChevronsUpDown, Wallet } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { VIETNAM_BANKS } from "@/data/vietnamBanks";
import { COUNTRIES_CURRENCIES } from "@/data/countriesCurrencies";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  branch: string | null;
  created_at: string;
}

export default function BankAccountsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasWithdrawalPassword, setHasWithdrawalPassword] = useState<boolean | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [showCountryStep, setShowCountryStep] = useState(false);
  const [showCryptoSoon, setShowCryptoSoon] = useState(false);

  // Lưu lựa chọn quốc gia / tiền tệ gần nhất
  const RECENT_COUNTRY_KEY = "recent_country_code";
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() => {
    if (typeof window === "undefined") return "VN";
    return localStorage.getItem(RECENT_COUNTRY_KEY) || "VN";
  });
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const selectedCountry = COUNTRIES_CURRENCIES.find(c => c.countryCode === selectedCountryCode) || COUNTRIES_CURRENCIES[0];
  
  // Form states — khôi phục ngân hàng đã chọn lần trước từ localStorage
  const RECENT_BANK_KEY = "recent_bank_name";
  const [bankName, setBankName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(RECENT_BANK_KEY) || "";
  });
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [branch, setBranch] = useState("");
  
  // Check if we came from withdraw page and should return with selected account
  const isSelectMode = location.state?.selectMode === true;
  const savedCountry = location.state?.savedCountry;
  const savedCurrency = location.state?.savedCurrency;

  const hasBankAccount = accounts.length > 0;

  const handleOpenLinkFlow = () => {
    if (hasWithdrawalPassword === false) {
      setShowPasswordPrompt(true);
      return;
    }
    setShowCountryStep(true);
  };

  const handleConfirmCountry = () => {
    try {
      localStorage.setItem(RECENT_COUNTRY_KEY, selectedCountryCode);
    } catch {
      // ignore
    }
    setShowCountryStep(false);
    setShowAddForm(true);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (user) {
      fetchBankAccounts();
      // Check withdrawal password status
      supabase.rpc('has_withdrawal_password', { _user_id: user.id })
        .then(({ data }) => setHasWithdrawalPassword(data === true));
    }
  }, [user, authLoading, navigate]);

  const fetchBankAccounts = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching bank accounts:", error);
        toast.error("Không thể tải danh sách tài khoản ngân hàng");
        return;
      }

      setAccounts(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!user) return;

    if (accounts.length > 0) {
      toast.error("Bạn chỉ có thể liên kết 1 tài khoản ngân hàng");
      setShowAddForm(false);
      return;
    }

    if (!bankName.trim()) {
      toast.error("Vui lòng nhập tên ngân hàng");
      return;
    }
    if (!accountNumber.trim()) {
      toast.error("Vui lòng nhập số tài khoản");
      return;
    }
    if (!accountHolder.trim()) {
      toast.error("Vui lòng nhập tên chủ tài khoản");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: user.id,
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_holder: accountHolder.trim().toUpperCase(),
          branch: branch.trim() || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error adding bank account:", error);
        toast.error("Không thể thêm tài khoản ngân hàng");
        return;
      }

      toast.success("Đã thêm tài khoản ngân hàng");
      setShowAddForm(false);
      resetForm();
      fetchBankAccounts();
      
      // If in select mode, return to withdraw with the new account
      if (isSelectMode && data) {
        handleSelectAccount(data);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Đã xảy ra lỗi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectAccount = (account: BankAccount) => {
    if (isSelectMode) {
      navigate('/withdraw', { 
        state: { 
          selectedAccount: account,
          savedCountry: savedCountry,
          savedCurrency: savedCurrency,
        } 
      });
    }
  };

  const resetForm = () => {
    // Giữ lại ngân hàng gần đây để lần sau mở form vẫn còn
    const recent = localStorage.getItem(RECENT_BANK_KEY) || "";
    setBankName(recent);
    setAccountNumber("");
    setAccountHolder("");
    setBranch("");
  };

  const maskAccountNumber = (number: string) => {
    if (number.length <= 4) return number;
    const firstPart = number.slice(0, 4);
    const lastPart = number.slice(-4);
    return `${firstPart}**${lastPart}`;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
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
            <h1 className="text-lg md:text-xl font-bold text-foreground flex-1 text-center pr-10">
              Quản lý tài khoản rút tiền
            </h1>
          </div>

          {/* Content */}
          <div className="space-y-3 md:space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : accounts.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center text-muted-foreground text-xs md:text-sm">
                  Chưa có tài khoản ngân hàng nào
                </CardContent>
              </Card>
            ) : (
              accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleSelectAccount(account)}
                  className="w-full"
                >
                  <Card className="bg-card border-border hover:bg-muted/50 transition-colors">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 text-left">
                          <div className="font-medium text-sm md:text-base text-foreground">
                            {account.bank_name}
                          </div>
                          <div className="text-sm md:text-base text-foreground">
                            {account.account_holder}
                          </div>
                          {account.branch && (
                            <div className="text-muted-foreground text-[10px] md:text-xs">
                              {account.branch}
                            </div>
                          )}
                          <div className="text-sm md:text-base text-foreground font-mono">
                            {maskAccountNumber(account.account_number)}
                          </div>
                          <div className="text-muted-foreground text-[10px] md:text-xs">
                            {format(new Date(account.created_at), 'yyyy-MM-dd hh:mm:ss a')}
                          </div>
                        </div>
                        {isSelectMode && (
                          <ChevronRight className="h-5 w-5 text-muted-foreground mt-4 shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))
            )}
          </div>

          {/* Add Button */}
          <div className="mt-6 md:mt-8">
            {hasBankAccount ? (
              <Button
                onClick={() => setShowCryptoSoon(true)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold min-h-[48px] md:min-h-[52px] rounded-lg text-sm md:text-base"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Thêm địa chỉ ví tiền điện tử (USDT)
              </Button>
            ) : (
              <Button
                onClick={handleOpenLinkFlow}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold min-h-[48px] md:min-h-[52px] rounded-lg text-sm md:text-base"
              >
                <Plus className="w-5 h-5 mr-2" />
                Liên kết tài khoản ngân hàng
              </Button>
            )}
            {hasBankAccount && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Bạn chỉ có thể liên kết 1 tài khoản ngân hàng. Để thay đổi, vui lòng liên hệ hỗ trợ.
              </p>
            )}
          </div>

          {/* Country & Currency Step Dialog */}
          <Dialog open={showCountryStep} onOpenChange={setShowCountryStep}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Chọn quốc gia & loại tiền tệ</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Vui lòng chọn quốc gia và loại tiền tệ trước khi liên kết tài khoản ngân hàng.
                </p>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Quốc gia / Tiền tệ <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={countryPickerOpen} onOpenChange={setCountryPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={countryPickerOpen}
                        className="w-full justify-between bg-muted/50 border-border text-sm font-normal h-10"
                      >
                        <span className="truncate text-left flex items-center gap-2">
                          <span className="text-base">{selectedCountry.flag}</span>
                          <span>{selectedCountry.countryName}</span>
                          <span className="text-muted-foreground">— {selectedCountry.currencyCode}</span>
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0 bg-popover z-[100]"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Tìm quốc gia hoặc tiền tệ..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy.</CommandEmpty>
                          <CommandGroup>
                            {COUNTRIES_CURRENCIES.map((c) => (
                              <CommandItem
                                key={c.countryCode}
                                value={`${c.countryName} ${c.currencyCode} ${c.currencyName}`}
                                onSelect={() => {
                                  setSelectedCountryCode(c.countryCode);
                                  setCountryPickerOpen(false);
                                }}
                              >
                                <span className="text-base mr-2">{c.flag}</span>
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-medium text-sm">{c.countryName}</span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {c.currencyCode} — {c.currencyName}
                                  </span>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    selectedCountryCode === c.countryCode ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowCountryStep(false)}>
                  Huỷ
                </Button>
                <Button onClick={handleConfirmCountry}>
                  Tiếp tục
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Crypto Wallet Coming Soon Dialog */}
          <Dialog open={showCryptoSoon} onOpenChange={setShowCryptoSoon}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  Thêm ví tiền điện tử (USDT)
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Tính năng liên kết ví tiền điện tử (USDT) đang được phát triển và sẽ sớm ra mắt. Vui lòng quay lại sau.
              </p>
              <DialogFooter>
                <Button onClick={() => setShowCryptoSoon(false)}>Đã hiểu</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Account Sheet */}
          <Sheet open={showAddForm} onOpenChange={setShowAddForm}>
            <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl bg-background">
              <SheetHeader className="text-center pb-4">
                <SheetTitle className="text-base md:text-lg font-semibold">Thêm tài khoản ngân hàng</SheetTitle>
              </SheetHeader>
              
              <div className="space-y-4 pb-6">
                {/* Country/Currency summary (read-only, đã chọn ở bước trước) */}
                <div className="space-y-2">
                  <Label className="text-[10px] md:text-xs text-muted-foreground">
                    Quốc gia & Tiền tệ
                  </Label>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-base">{selectedCountry.flag}</span>
                      <span className="truncate">{selectedCountry.countryName}</span>
                      <span className="text-muted-foreground">— {selectedCountry.currencyCode}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setShowAddForm(false);
                        setShowCountryStep(true);
                      }}
                    >
                      Đổi
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bankName" className="text-[10px] md:text-xs text-muted-foreground">
                    Tên ngân hàng <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={bankPickerOpen} onOpenChange={setBankPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="bankName"
                        variant="outline"
                        role="combobox"
                        aria-expanded={bankPickerOpen}
                        className={cn(
                          "w-full justify-between bg-muted/50 border-border text-sm md:text-base font-normal h-10",
                          !bankName && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate text-left">
                          {bankName || "Chọn ngân hàng..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0 bg-popover z-[100]"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Tìm ngân hàng..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy ngân hàng.</CommandEmpty>
                          <CommandGroup>
                            {VIETNAM_BANKS.map((bank) => (
                              <CommandItem
                                key={bank.code}
                                value={`${bank.shortName} ${bank.name}`}
                                onSelect={() => {
                                  setBankName(bank.name);
                                  try {
                                    localStorage.setItem(RECENT_BANK_KEY, bank.name);
                                  } catch {
                                    // ignore storage errors
                                  }
                                  setBankPickerOpen(false);
                                }}
                              >
                                <div className="flex flex-col flex-1 min-w-0">
                                  <span className="font-medium text-sm">{bank.shortName}</span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {bank.name}
                                  </span>
                                </div>
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    bankName === bank.name ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountNumber" className="text-[10px] md:text-xs text-muted-foreground">
                    Số tài khoản <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="accountNumber"
                    placeholder="Nhập số tài khoản"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-muted/50 border-border text-sm md:text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountHolder" className="text-[10px] md:text-xs text-muted-foreground">
                    Tên chủ tài khoản <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="accountHolder"
                    placeholder="VD: NGUYEN VAN A"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="bg-muted/50 border-border uppercase text-sm md:text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="branch" className="text-[10px] md:text-xs text-muted-foreground">
                    Chi nhánh
                  </Label>
                  <Input
                    id="branch"
                    placeholder="VD: BẮC NINH (không bắt buộc)"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="bg-muted/50 border-border text-sm md:text-base"
                  />
                </div>

                <Button
                  onClick={handleAddAccount}
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold min-h-[48px] md:min-h-[52px] rounded-lg mt-4 text-sm md:text-base"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    "Xác nhận thêm tài khoản"
                  )}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Withdrawal Password Required Dialog */}
      <Dialog open={showPasswordPrompt} onOpenChange={setShowPasswordPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Yêu cầu tạo mật khẩu rút tiền
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn cần tạo mật khẩu rút tiền trước khi liên kết tài khoản ngân hàng. Vui lòng đến trang Bảo mật để thiết lập.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPasswordPrompt(false)}>
              Để sau
            </Button>
            <Button onClick={() => navigate('/security')}>
              Đến trang Bảo mật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
