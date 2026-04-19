import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Wallet } from 'lucide-react';
import { format } from 'date-fns';

interface Row {
  id: string;
  user_id: string;
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
  user_email?: string;
  user_code?: number | null;
}

export default function AdminSavingsDeposits() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [stats, setStats] = useState({ active: 0, paid: 0, totalPrincipal: 0, totalPayout: 0 });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_savings_deposits')
      .select('*, savings_packages(title), profiles!user_savings_deposits_user_id_fkey(email, user_code)')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      // Fallback without profile join (RLS issue)
      const { data: data2 } = await supabase
        .from('user_savings_deposits')
        .select('*, savings_packages(title)')
        .order('created_at', { ascending: false })
        .limit(500);
      const mapped = (data2 || []).map((d: any) => ({
        ...d,
        package_title: d.savings_packages?.title,
      }));
      setRows(mapped);
      computeStats(mapped);
    } else {
      const mapped = (data || []).map((d: any) => ({
        ...d,
        package_title: d.savings_packages?.title,
        user_email: d.profiles?.email,
        user_code: d.profiles?.user_code,
      }));
      setRows(mapped);
      computeStats(mapped);
    }
    setLoading(false);
  }

  function computeStats(list: Row[]) {
    const s = { active: 0, paid: 0, totalPrincipal: 0, totalPayout: 0 };
    for (const r of list) {
      if (r.status === 'active') {
        s.active++;
        s.totalPrincipal += Number(r.principal_amount);
      }
      if (r.status === 'paid') {
        s.paid++;
        s.totalPayout += Number(r.total_payout);
      }
    }
    setStats(s);
  }

  async function runSettle() {
    setSettling(true);
    try {
      const { data, error } = await supabase.functions.invoke('settle-matured-savings');
      if (error) throw error;
      toast({
        title: 'Đã chạy settle',
        description: JSON.stringify(data),
      });
      load();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Khoản gửi tiết kiệm</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={runSettle} disabled={settling}>
            {settling && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            Chạy settle ngay
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Đang gửi</div>
          <div className="text-xl font-bold tabular-nums">{stats.active}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Đã đáo hạn</div>
          <div className="text-xl font-bold tabular-nums">{stats.paid}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Tổng gốc đang gửi</div>
          <div className="text-xl font-bold tabular-nums">${stats.totalPrincipal.toFixed(2)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Tổng đã trả</div>
          <div className="text-xl font-bold tabular-nums text-green-600">${stats.totalPayout.toFixed(2)}</div>
        </Card>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Gói</TableHead>
                <TableHead>Gốc</TableHead>
                <TableHead>Lãi</TableHead>
                <TableHead>Tổng</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bắt đầu</TableHead>
                <TableHead>Đáo hạn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">
                    {r.user_code ? `#${r.user_code}` : ''}
                    <div className="text-muted-foreground">{r.user_email || r.user_id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell className="text-xs">{r.package_title || '-'}</TableCell>
                  <TableCell className="tabular-nums">{r.principal_amount}</TableCell>
                  <TableCell className="tabular-nums text-green-600">+{r.interest_amount}</TableCell>
                  <TableCell className="tabular-nums font-medium">{r.total_payout}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === 'paid' ? 'default' : r.status === 'active' ? 'secondary' : 'outline'}
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{format(new Date(r.started_at), 'dd/MM HH:mm')}</TableCell>
                  <TableCell className="text-xs">{format(new Date(r.matures_at), 'dd/MM HH:mm')}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Chưa có khoản gửi nào
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
