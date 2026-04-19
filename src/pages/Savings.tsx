import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2, PiggyBank, TrendingUp, Clock, Wallet, History, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface SavingsPackage {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  currency: string;
  cycle_months: number;
  interest_rate_percent: number;
  min_deposit_amount: number;
  max_total_pool: number;
  current_pool: number;
  is_active: boolean;
  event_start_at: string | null;
  event_end_at: string | null;
  display_order: number;
}

interface UserDeposit {
  id: string;
  package_id: string;
  principal_amount: number;
  interest_amount: number;
  total_payout: number;
  interest_rate_percent: number;
  cycle_months: number;
  currency: string;
  status: string;
  started_at: string;
  matures_at: string;
  paid_at: string | null;
  package_title?: string;
}

export default function Savings() {
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const navigate = useNavigate();

  const [packages, setPackages] = useState<SavingsPackage[]>([]);
  const [deposits, setDeposits] = useState<UserDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<SavingsPackage | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({
    active_count: 0,
    total_principal: 0,
    total_expected_payout: 0,
    total_expected_interest: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [pkgRes, depRes, statsRes] = await Promise.all([
        supabase
          .from('savings_packages')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('user_savings_deposits')
          .select('*, savings_packages(title)')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_user_active_savings_total', { _user_id: user!.id }),
      ]);

      if (pkgRes.data) setPackages(pkgRes.data as SavingsPackage[]);
      if (depRes.data) {
        setDeposits(
          depRes.data.map((d: any) => ({
            ...d,
            package_title: d.savings_packages?.title,
          }))
        );
      }
      if (statsRes.data && statsRes.data[0]) {
        const s = statsRes.data[0];
        setStats({
          active_count: Number(s.active_count) || 0,
          total_principal: Number(s.total_principal) || 0,
          total_expected_payout: Number(s.total_expected_payout) || 0,
          total_expected_interest: Number(s.total_expected_interest) || 0,
        });
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeposit() {
    if (!selectedPackage || !user) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Số tiền không hợp lệ', variant: 'destructive' });
      return;
    }
    if (amt < selectedPackage.min_deposit_amount) {
      toast({
        title: `Số tiền tối thiểu là ${selectedPackage.min_deposit_amount} ${selectedPackage.currency}`,
        variant: 'destructive',
      });
      return;
    }
    if ((profile?.balance ?? 0) < amt) {
      toast({ title: 'Số dư không đủ', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_savings_deposit', {
        _user_id: user.id,
        _package_id: selectedPackage.id,
        _amount: amt,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast({ title: result?.error || 'Có lỗi xảy ra', variant: 'destructive' });
        return;
      }
      toast({
        title: '🎉 Gửi tiết kiệm thành công',
        description: `Đáo hạn nhận ${result.total_payout} ${selectedPackage.currency}`,
      });
      setSelectedPackage(null);
      setAmount('');
      await Promise.all([loadData(), refetchProfile()]);
    } catch (e: any) {
      toast({ title: e.message || 'Lỗi', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const expectedInterest = selectedPackage && amount
    ? Number(amount) * selectedPackage.interest_rate_percent / 100
    : 0;
  const expectedPayout = selectedPackage && amount ? Number(amount) + expectedInterest : 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 pb-24 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <PiggyBank className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tiết kiệm</h1>
            <p className="text-sm text-muted-foreground">Gửi tiết kiệm, nhận lãi định kỳ</p>
          </div>
        </div>

        {/* Stats card */}
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3 h-3" /> Số dư
              </div>
              <div className="text-lg font-bold tabular-nums">
                ${(profile?.balance ?? 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <PiggyBank className="w-3 h-3" /> Đang gửi
              </div>
              <div className="text-lg font-bold tabular-nums">
                ${stats.total_principal.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Lãi dự kiến
              </div>
              <div className="text-lg font-bold tabular-nums text-green-600">
                +${stats.total_expected_interest.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Khoản active
              </div>
              <div className="text-lg font-bold tabular-nums">{stats.active_count}</div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="packages">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="packages">Gói tiết kiệm</TabsTrigger>
            <TabsTrigger value="my-deposits">Khoản gửi của tôi</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4 mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : packages.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Hiện chưa có gói tiết kiệm nào
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map((pkg) => {
                  const poolPct = pkg.max_total_pool > 0
                    ? Math.min(100, (pkg.current_pool / pkg.max_total_pool) * 100)
                    : 0;
                  return (
                    <Card key={pkg.id} className="p-4 hover:border-primary/50 transition-all">
                      {pkg.image_url && (
                        <img
                          src={pkg.image_url}
                          alt={pkg.title}
                          className="w-full h-32 object-cover rounded-lg mb-3"
                        />
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{pkg.title}</h3>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary tabular-nums">
                            {pkg.interest_rate_percent}%
                          </div>
                          <div className="text-xs text-muted-foreground">/ chu kỳ</div>
                        </div>
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {pkg.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Chu kỳ</div>
                          <div className="font-medium">{pkg.cycle_months} tháng</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Tối thiểu</div>
                          <div className="font-medium tabular-nums">
                            {pkg.min_deposit_amount} {pkg.currency}
                          </div>
                        </div>
                      </div>
                      {pkg.max_total_pool > 0 && (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Quỹ đã gửi</span>
                            <span className="tabular-nums">
                              {pkg.current_pool.toFixed(0)} / {pkg.max_total_pool.toFixed(0)}
                            </span>
                          </div>
                          <Progress value={poolPct} className="h-1.5" />
                        </div>
                      )}
                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setAmount(String(pkg.min_deposit_amount));
                        }}
                      >
                        Gửi tiết kiệm <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-deposits" className="space-y-3 mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : deposits.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Bạn chưa có khoản gửi nào
              </Card>
            ) : (
              deposits.map((dep) => {
                const isActive = dep.status === 'active';
                const isPaid = dep.status === 'paid';
                return (
                  <Card key={dep.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold">{dep.package_title || 'Gói tiết kiệm'}</div>
                        <div className="text-xs text-muted-foreground">
                          Gửi: {format(new Date(dep.started_at), 'dd/MM/yyyy HH:mm')}
                        </div>
                      </div>
                      <div
                        className={`text-xs px-2 py-1 rounded-full ${
                          isPaid
                            ? 'bg-green-500/15 text-green-600'
                            : isActive
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isPaid ? 'Đã đáo hạn' : isActive ? 'Đang chạy' : dep.status}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Gốc</div>
                        <div className="font-medium tabular-nums">
                          {dep.principal_amount} {dep.currency}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Lãi ({dep.interest_rate_percent}%)</div>
                        <div className="font-medium tabular-nums text-green-600">
                          +{dep.interest_amount}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Tổng nhận</div>
                        <div className="font-bold tabular-nums text-primary">
                          {dep.total_payout}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                      {isPaid && dep.paid_at
                        ? `Đã trả: ${format(new Date(dep.paid_at), 'dd/MM/yyyy HH:mm')}`
                        : `Đáo hạn: ${format(new Date(dep.matures_at), 'dd/MM/yyyy HH:mm')} (${formatDistanceToNow(new Date(dep.matures_at), { locale: vi, addSuffix: true })})`}
                    </div>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Deposit dialog */}
      <Dialog open={!!selectedPackage} onOpenChange={(o) => !o && setSelectedPackage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gửi tiết kiệm: {selectedPackage?.title}</DialogTitle>
            <DialogDescription>
              Lãi suất {selectedPackage?.interest_rate_percent}% / {selectedPackage?.cycle_months} tháng
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Số dư khả dụng: <span className="font-semibold tabular-nums">${(profile?.balance ?? 0).toFixed(2)}</span>
              </div>
              <Input
                type="number"
                placeholder={`Tối thiểu ${selectedPackage?.min_deposit_amount}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            {Number(amount) > 0 && selectedPackage && (
              <Card className="p-3 bg-muted/50">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gốc</span>
                    <span className="tabular-nums">{Number(amount).toFixed(2)} {selectedPackage.currency}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Lãi nhận được</span>
                    <span className="tabular-nums">+{expectedInterest.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Tổng đáo hạn</span>
                    <span className="tabular-nums text-primary">{expectedPayout.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            )}
            <Button
              className="w-full"
              disabled={submitting || !amount}
              onClick={handleDeposit}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Xác nhận gửi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
