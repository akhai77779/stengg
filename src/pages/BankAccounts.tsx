import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, Plus, Loader2, ShieldAlert } from "lucide-react";
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
  
  // Form states
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [branch, setBranch] = useState("");
  
  // Check if we came from withdraw page and should return with selected account
  const isSelectMode = location.state?.selectMode === true;
  const savedCountry = location.state?.savedCountry;
  const savedCurrency = location.state?.savedCurrency;

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
    setBankName("");
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
            <Button
              onClick={() => setShowAddForm(true)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold min-h-[48px] md:min-h-[52px] rounded-lg text-sm md:text-base"
            >
              <Plus className="w-5 h-5 mr-2" />
              Liên kết tài khoản ngân hàng
            </Button>
          </div>

          {/* Add Account Sheet */}
          <Sheet open={showAddForm} onOpenChange={setShowAddForm}>
            <SheetContent side="bottom" className="h-auto max-h-[90vh] rounded-t-2xl bg-background">
              <SheetHeader className="text-center pb-4">
                <SheetTitle className="text-base md:text-lg font-semibold">Thêm tài khoản ngân hàng</SheetTitle>
              </SheetHeader>
              
              <div className="space-y-4 pb-6">
                <div className="space-y-2">
                  <Label htmlFor="bankName" className="text-[10px] md:text-xs text-muted-foreground">
                    Tên ngân hàng <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bankName"
                    placeholder="VD: Ngân hàng TMCP Kỹ thương Việt Nam (TCB)"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="bg-muted/50 border-border text-sm md:text-base"
                  />
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
    </Layout>
  );
}
