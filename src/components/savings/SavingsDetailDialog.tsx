import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Loader2, Wallet, PiggyBank, History, TrendingUp, Calendar, Users, Coins } from 'lucide-react';
import { format } from 'date-fns';

export interface SavingsPackage {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cycle_months: number;
  interest_rate_percent: number;
  min_deposit_amount: number;
  max_total_pool: number;
  current_pool: number;
  currency: string;
  event_start_at: string | null;
  event_end_at: string | null;
  is_active: boolean;
}

interface MyDeposit {
  id: string;
  principal_amount: number;
  interest_amount: number;
  total_payout: number;
  cycle_months: number;
  interest_rate_percent: number;
  currency: string;
  status: string;
  started_at: string;
  matures_at: string;
  paid_at: string | null;
}

interface SavingsDetailDialogProps {
  pkg: SavingsPackage | null;
  onClose: () => void;
  onDepositSuccess: () => void;
}

export function SavingsDetailDialog({ pkg, onClose, onDepositSuccess }: SavingsDetailDialogProps) {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [myDeposits, setMyDeposits] = useState<MyDeposit[]>([]);
  const [isLoadingDeposits, setIsLoadingDeposits] = useState(false);
  const [stats, setStats] = useState<{ unique_depositors: number; total_deposits: number; active_principal: number } | null>(null);

  const fetchMyDeposits = async () => {
    if (!user || !pkg) return;
    setIsLoadingDeposits(true);
    const { data, error } = await supabase
      .from('user_savings_deposits')
      .select('*')
      .eq('user_id', user.id)
      .eq('package_id', pkg.id)
      .order('created_at', { ascending: false });
    if (!error) setMyDeposits((data as MyDeposit[]) || []);
    setIsLoadingDeposits(false);
  };

  const fetchStats = async () => {
    if (!pkg) return;
    const { data, error } = await supabase.rpc('get_savings_package_stats', { _package_id: pkg.id });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setStats({
          unique_depositors: Number(row.unique_depositors ?? 0),
          total_deposits: Number(row.total_deposits ?? 0),
          active_principal: Number(row.active_principal ?? 0),
        });
      }
    }
  };

  useEffect(() => {
    if (pkg?.id) {
      fetchMyDeposits();
      fetchStats();
    } else {
      setMyDeposits([]);
      setStats(null);
      setActiveTab('info');
      setAmount('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.id]);

  if (!pkg) return null;

  const amt = parseFloat(amount) || 0;
  const expectedInterest = amt * pkg.interest_rate_percent / 100;
  const expectedPayout = amt + expectedInterest;
  const poolProgress = pkg.max_total_pool > 0 ? Math.min((pkg.current_pool / pkg.max_total_pool) * 100, 100) : 0;
  const remaining = Math.max(pkg.max_total_pool - pkg.current_pool, 0);

  const requestDeposit = () => {
    if (!user) return;
    if (!amt || amt <= 0) {
      toast({ title: 'Số tiền không hợp lệ', variant: 'destructive' });
      return;
    }
    if (amt < pkg.min_deposit_amount) {
      toast({ title: `Tối thiểu ${pkg.min_deposit_amount} ${pkg.currency}`, variant: 'destructive' });
      return;
    }
    if ((profile?.balance ?? 0) < amt) {
      toast({ title: 'Số dư không đủ', variant: 'destructive' });
      return;
    }
    setConfirmOpen(true);
  };

  const handleDeposit = async () => {
    if (!user || !amt) return;
    setConfirmOpen(false);
    setIsSubmitting(true);
    const { data, error } = await supabase.rpc('create_savings_deposit', {
      _user_id: user.id,
      _package_id: pkg.id,
      _amount: amt,
    });
    setIsSubmitting(false);
    const result = data as { success: boolean; error?: string; total_payout?: number; matures_at?: string } | null;
    if (error || !result?.success) {
      toast({ title: 'Gửi tiết kiệm thất bại', description: result?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({
      title: '💰 Gửi tiết kiệm thành công',
      description: `Đáo hạn nhận ${result.total_payout?.toLocaleString()} ${pkg.currency}`,
    });
    setAmount('');
    await Promise.all([refetchProfile(), fetchMyDeposits(), fetchStats()]);
    onDepositSuccess();
  };

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px]">Đang chạy</Badge>;
    if (status === 'paid') return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Đã đáo hạn</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  };

  return (
    <Dialog open={!!pkg} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px]">
              <PiggyBank className="w-3 h-3 mr-1" /> Tiết kiệm
            </Badge>
          </div>
          <DialogTitle className="text-left mt-1">{pkg.title}</DialogTitle>
          {pkg.description && (
            <DialogDescription className="text-left whitespace-pre-line">
              {pkg.description}
            </DialogDescription>
          )}
        </DialogHeader>

        {pkg.image_url && (
          <img src={pkg.image_url} alt={pkg.title} className="w-full rounded-lg mt-2" />
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="info" className="text-xs gap-1">
              <PiggyBank className="w-3.5 h-3.5" /> Gửi tiết kiệm
            </TabsTrigger>
            <TabsTrigger value="my" className="text-xs gap-1">
              <History className="w-3.5 h-3.5" /> Của tôi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-3 pt-3 mt-0">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Lãi suất
                </div>
                <div className="font-semibold text-success">{pkg.interest_rate_percent}%</div>
              </div>
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                  <Calendar className="w-3 h-3" /> Kỳ hạn
                </div>
                <div className="font-semibold text-foreground">{pkg.cycle_months} tháng</div>
              </div>
              <div className="bg-muted/40 rounded-lg p-2 text-center">
                <div className="text-muted-foreground mb-0.5 flex items-center justify-center gap-1">
                  <Coins className="w-3 h-3" /> Tối thiểu
                </div>
                <div className="font-semibold text-foreground">{pkg.min_deposit_amount}</div>
              </div>
            </div>

            {pkg.max_total_pool > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Quỹ đã huy động</span>
                  <span className="text-primary font-medium">{poolProgress.toFixed(0)}%</span>
                </div>
                <Progress value={poolProgress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{pkg.current_pool.toLocaleString()} {pkg.currency}</span>
                  <span>Còn {remaining.toLocaleString()} {pkg.currency}</span>
                </div>
              </div>
            )}

            {stats && (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1.5 bg-primary/5 border border-primary/15 rounded-lg px-2.5 py-1.5">
                  <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground leading-none">Người gửi</div>
                    <div className="text-xs font-bold text-foreground tabular-nums">{stats.unique_depositors}</div>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-1.5 bg-success/5 border border-success/15 rounded-lg px-2.5 py-1.5">
                  <Coins className="w-3.5 h-3.5 text-success shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground leading-none">Lượt gửi</div>
                    <div className="text-xs font-bold text-foreground tabular-nums">{stats.total_deposits}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> Số dư khả dụng
                </span>
                <span className="font-semibold text-foreground">
                  {(profile?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                </span>
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={`Tối thiểu ${pkg.min_deposit_amount} ${pkg.currency}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={pkg.min_deposit_amount}
                  step="0.01"
                  disabled={isSubmitting}
                  className="h-10"
                />
                <Button onClick={requestDeposit} disabled={isSubmitting || !amount} className="shrink-0 bg-blue-500 hover:bg-blue-600 text-white">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PiggyBank className="w-4 h-4" /> Gửi</>}
                </Button>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {[100, 500, 1000, 5000].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(String(v))}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 text-xs rounded-md bg-muted/60 hover:bg-muted text-foreground transition-colors disabled:opacity-50"
                  >
                    {v}
                  </button>
                ))}
              </div>

              {amt > 0 && (
                <div className="bg-success/5 border border-success/20 rounded-lg p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tiền gốc</span>
                    <span className="font-semibold tabular-nums">{amt.toLocaleString()} {pkg.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lãi dự kiến ({pkg.interest_rate_percent}%)</span>
                    <span className="font-semibold text-success tabular-nums">+{expectedInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pkg.currency}</span>
                  </div>
                  <div className="flex justify-between border-t border-success/20 pt-1">
                    <span className="text-foreground font-medium">Nhận khi đáo hạn</span>
                    <span className="font-bold text-success tabular-nums">{expectedPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pkg.currency}</span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="my" className="pt-3 mt-0">
            {isLoadingDeposits ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : myDeposits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <PiggyBank className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Bạn chưa gửi tiết kiệm cho gói này
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {myDeposits.map(d => (
                  <div key={d.id} className="bg-muted/30 rounded-lg p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground tabular-nums">
                        {Number(d.principal_amount).toLocaleString()} {d.currency}
                      </span>
                      {statusBadge(d.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
                      <div>Lãi: <span className="text-success font-medium">+{Number(d.interest_amount).toLocaleString()}</span></div>
                      <div>Nhận: <span className="text-foreground font-medium">{Number(d.total_payout).toLocaleString()}</span></div>
                      <div>Bắt đầu: <span className="text-foreground">{format(new Date(d.started_at), 'dd/MM/yy')}</span></div>
                      <div>Đáo hạn: <span className="text-foreground">{format(new Date(d.matures_at), 'dd/MM/yy')}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* Confirm deposit */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-blue-500" />
              Xác nhận gửi tiết kiệm
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div>
                  Bạn chắc chắn muốn gửi tiết kiệm{' '}
                  <span className="font-semibold text-foreground">
                    {amt.toLocaleString()} {pkg.currency}
                  </span>{' '}
                  vào gói <span className="font-semibold text-foreground">"{pkg.title}"</span>?
                </div>
                <div className="bg-muted/40 rounded-md p-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Kỳ hạn</span>
                    <span className="font-medium text-foreground">{pkg.cycle_months} tháng</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lãi dự kiến ({pkg.interest_rate_percent}%)</span>
                    <span className="font-medium text-success">+{expectedInterest.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pkg.currency}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1">
                    <span>Nhận khi đáo hạn</span>
                    <span className="font-bold text-success">{expectedPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pkg.currency}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeposit} disabled={isSubmitting} className="bg-blue-500 hover:bg-blue-600 text-white">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
