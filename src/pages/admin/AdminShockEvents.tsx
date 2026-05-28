import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';

interface ShockEvent {
  id: string;
  product_id: string;
  shock_type: 'pump' | 'dump';
  magnitude: number;
  scheduled_at: string;
  applied: boolean;
  applied_at: string | null;
  created_at: string;
}

interface ProductOption {
  id: string;
  name: string;
  symbol: string | null;
  price: number | null;
}

export default function AdminShockEvents() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [events, setEvents] = useState<ShockEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState('');
  const [shockType, setShockType] = useState<'pump' | 'dump'>('pump');
  const [magnitude, setMagnitude] = useState('5');
  const [scheduledAt, setScheduledAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [prodRes, evRes] = await Promise.all([
      supabase.from('products').select('id, name, symbol, price').order('name'),
      supabase
        .from('shock_events')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(100),
    ]);
    if (prodRes.data) setProducts(prodRes.data as ProductOption[]);
    if (evRes.data) setEvents(evRes.data as ShockEvent[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
    const ch = supabase
      .channel('shock_events_admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shock_events' },
        () => loadAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadAll]);

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('Chọn sản phẩm');
      return;
    }
    const mag = parseFloat(magnitude);
    if (!Number.isFinite(mag) || mag <= 0) {
      toast.error('Biên độ phải > 0');
      return;
    }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const scheduledIso = scheduledAt
      ? new Date(scheduledAt).toISOString()
      : new Date().toISOString();
    const { error } = await supabase.from('shock_events').insert({
      product_id: productId,
      shock_type: shockType,
      magnitude: mag,
      scheduled_at: scheduledIso,
      created_by: user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Đã tạo shock event');
    setMagnitude('5');
    setScheduledAt('');
    loadAll();
  };

  const productName = (id: string) => {
    const p = products.find(p => p.id === id);
    return p ? `${p.name}${p.symbol ? ` (${p.symbol})` : ''}` : id.slice(0, 8);
  };

  return (
    <div className="space-y-6 p-4 md:p-0">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" /> Shock Events
        </h1>
        <p className="text-sm text-muted-foreground">
          Lên lịch sự kiện sốc giá (pump/dump). Engine sẽ áp dụng trong tick gần nhất sau thời điểm lên lịch.
        </p>
      </div>

      {/* New event form */}
      <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
        <div className="text-sm font-semibold">Tạo shock event mới</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground">Sản phẩm</label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Chọn sản phẩm" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.symbol && `(${p.symbol})`}
                    {p.price != null && ` · $${Number(p.price).toFixed(2)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Loại</label>
            <Select value={shockType} onValueChange={(v) => setShockType(v as 'pump' | 'dump')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pump">Pump (tăng)</SelectItem>
                <SelectItem value="dump">Dump (giảm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Biên độ (%)</label>
            <Input
              type="number"
              value={magnitude}
              onChange={e => setMagnitude(e.target.value)}
              className="h-9"
              min={0.1}
              step={0.1}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Thời điểm</label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting} size="sm">
            <Zap className="h-4 w-4 mr-1" />
            {submitting ? 'Đang tạo...' : 'Tạo Shock'}
          </Button>
        </div>
      </div>

      {/* Events list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border text-sm font-semibold">
          Lịch sử ({events.length})
        </div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Chưa có shock event nào.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Biên độ</TableHead>
                <TableHead>Lên lịch</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Áp dụng lúc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map(ev => (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">{productName(ev.product_id)}</TableCell>
                  <TableCell>
                    {ev.shock_type === 'pump' ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3.5 w-3.5" /> Pump
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-3.5 w-3.5" /> Dump
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(ev.magnitude).toFixed(2)}%</TableCell>
                  <TableCell className="text-xs">{new Date(ev.scheduled_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {ev.applied ? (
                      <Badge variant="secondary">Đã áp dụng</Badge>
                    ) : (
                      <Badge variant="outline">Chờ</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {ev.applied_at ? new Date(ev.applied_at).toLocaleString() : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}