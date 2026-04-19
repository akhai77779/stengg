import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Download, Heart, Loader2, Search, Users, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface DonationRow {
  id: string;
  user_id: string;
  program_id: string;
  program_title: string | null;
  amount: number;
  currency: string;
  donor_email: string | null;
  donor_name: string | null;
  user_code: number | null;
  created_at: string;
}

interface ProgramOption {
  id: string;
  title: string;
}

export default function AdminCharityDonations() {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const loadPrograms = async () => {
      const { data } = await supabase
        .from('charity_programs')
        .select('id, title')
        .order('created_at', { ascending: false });
      setPrograms(data || []);
    };
    loadPrograms();
  }, []);

  useEffect(() => {
    const loadDonations = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_all_charity_donations', {
        _program_id: programFilter === 'all' ? null : programFilter,
        _limit: 1000,
        _offset: 0,
      });
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: error.message,
        });
        setDonations([]);
      } else {
        setDonations((data as DonationRow[]) || []);
      }
      setIsLoading(false);
    };
    loadDonations();
  }, [programFilter, toast]);

  const filtered = useMemo(() => {
    let result = donations;
    if (dateFilter !== 'all') {
      const days = Number(dateFilter);
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      result = result.filter((d) => new Date(d.created_at).getTime() >= cutoff);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((d) =>
        [d.donor_email, d.donor_name, d.program_title, String(d.user_code ?? '')]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q))
      );
    }
    return result;
  }, [donations, search, dateFilter]);

  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const uniqueDonors = new Set(filtered.map((d) => d.user_id)).size;
    return {
      count: filtered.length,
      uniqueDonors,
      totalAmount,
    };
  }, [filtered]);

  const exportCSV = () => {
    setIsExporting(true);
    try {
      const headers = [
        'Thời gian',
        'Quỹ',
        'Mã user',
        'Tên',
        'Email',
        'Số tiền',
        'Tiền tệ',
      ];
      const rows = filtered.map((d) => [
        format(new Date(d.created_at), 'yyyy-MM-dd HH:mm:ss'),
        d.program_title || '',
        d.user_code ?? '',
        d.donor_name || '',
        d.donor_email || '',
        Number(d.amount || 0).toFixed(2),
        d.currency || 'USD',
      ]);
      const escape = (v: unknown) => {
        const s = String(v ?? '');
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
      const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `charity-donations-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Đã xuất CSV', description: `${filtered.length} dòng` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Quyên góp từ thiện</h1>
        <p className="text-sm text-muted-foreground">
          Tổng quan các khoản quyên góp từ user, lọc theo quỹ và xuất CSV.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tổng lượt</div>
              <div className="text-lg font-bold tabular-nums">{stats.count}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Nhà hảo tâm</div>
              <div className="text-lg font-bold tabular-nums">{stats.uniqueDonors}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tổng tiền (USDT)</div>
              <div className="text-lg font-bold tabular-nums">
                {stats.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Danh sách quyên góp</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Chọn quỹ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả các quỹ</SelectItem>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Khoảng thời gian" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả thời gian</SelectItem>
                <SelectItem value="30">30 ngày qua</SelectItem>
                <SelectItem value="60">60 ngày qua</SelectItem>
                <SelectItem value="90">90 ngày qua</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm email, tên, mã..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 w-[220px]"
              />
            </div>
            <Button
              onClick={exportCSV}
              disabled={isExporting || filtered.length === 0}
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Xuất CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Không có dữ liệu quyên góp.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Quỹ</TableHead>
                    <TableHead>Người quyên góp</TableHead>
                    <TableHead>Mã</TableHead>
                    <TableHead className="text-right">Số tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {format(new Date(d.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">
                        {d.program_title || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="font-medium text-sm truncate">
                          {d.donor_name || 'Ẩn danh'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {d.donor_email || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {d.user_code ? (
                          <Badge variant="outline" className="tabular-nums">
                            #{d.user_code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary tabular-nums">
                        +{Number(d.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
                        {d.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
