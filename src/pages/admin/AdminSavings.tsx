import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, PiggyBank } from 'lucide-react';

interface Pkg {
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
  display_order: number;
  event_start_at: string | null;
  event_end_at: string | null;
}

const empty: Partial<Pkg> = {
  title: '',
  description: '',
  image_url: '',
  currency: 'USD',
  cycle_months: 3,
  interest_rate_percent: 5,
  min_deposit_amount: 100,
  max_total_pool: 0,
  is_active: true,
  display_order: 0,
};

export default function AdminSavings() {
  const [items, setItems] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Pkg>>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('savings_packages')
      .select('*')
      .order('display_order', { ascending: true });
    if (error) toast({ title: error.message, variant: 'destructive' });
    else setItems((data as Pkg[]) || []);
    setLoading(false);
  }

  function openNew() {
    setForm(empty);
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p: Pkg) {
    setForm(p);
    setEditing(p.id);
    setOpen(true);
  }

  async function save() {
    if (!form.title || !form.cycle_months || !form.interest_rate_percent) {
      toast({ title: 'Vui lòng điền đủ thông tin', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title!,
        description: form.description || null,
        image_url: form.image_url || null,
        currency: form.currency || 'USD',
        cycle_months: Number(form.cycle_months),
        interest_rate_percent: Number(form.interest_rate_percent),
        min_deposit_amount: Number(form.min_deposit_amount) || 0,
        max_total_pool: Number(form.max_total_pool) || 0,
        is_active: !!form.is_active,
        display_order: Number(form.display_order) || 0,
      };
      if (editing) {
        const { error } = await supabase.from('savings_packages').update(payload).eq('id', editing);
        if (error) throw error;
        toast({ title: 'Đã cập nhật' });
      } else {
        const { error } = await supabase.from('savings_packages').insert(payload);
        if (error) throw error;
        toast({ title: 'Đã tạo gói mới' });
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Pkg) {
    const { error } = await supabase
      .from('savings_packages')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) toast({ title: error.message, variant: 'destructive' });
    else load();
  }

  async function remove(id: string) {
    if (!confirm('Xóa gói này? Khoản gửi đã có sẽ vẫn tồn tại.')) return;
    const { error } = await supabase.from('savings_packages').delete().eq('id', id);
    if (error) toast({ title: error.message, variant: 'destructive' });
    else load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Gói tiết kiệm</h2>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Thêm gói
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Lãi (%)</TableHead>
                <TableHead>Chu kỳ</TableHead>
                <TableHead>Tối thiểu</TableHead>
                <TableHead>Quỹ</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="tabular-nums">{p.interest_rate_percent}%</TableCell>
                  <TableCell>{p.cycle_months} th</TableCell>
                  <TableCell className="tabular-nums">{p.min_deposit_amount}</TableCell>
                  <TableCell className="tabular-nums text-xs">
                    {p.current_pool.toFixed(0)} / {p.max_total_pool > 0 ? p.max_total_pool.toFixed(0) : '∞'}
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Chưa có gói nào
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa gói tiết kiệm' : 'Thêm gói tiết kiệm'}</DialogTitle>
            <DialogDescription>Cấu hình lãi suất và chu kỳ</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên gói *</Label>
              <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Mô tả</Label>
              <Textarea
                value={form.description || ''}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <Label>URL hình ảnh</Label>
              <Input
                value={form.image_url || ''}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lãi suất (%) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.interest_rate_percent ?? ''}
                  onChange={(e) => setForm({ ...form, interest_rate_percent: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Chu kỳ (tháng) *</Label>
                <Input
                  type="number"
                  value={form.cycle_months ?? ''}
                  onChange={(e) => setForm({ ...form, cycle_months: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tối thiểu / lần gửi</Label>
                <Input
                  type="number"
                  value={form.min_deposit_amount ?? ''}
                  onChange={(e) => setForm({ ...form, min_deposit_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tổng pool tối đa (0 = ∞)</Label>
                <Input
                  type="number"
                  value={form.max_total_pool ?? ''}
                  onChange={(e) => setForm({ ...form, max_total_pool: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Tiền tệ</Label>
                <Input
                  value={form.currency || 'USD'}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </div>
              <div>
                <Label>Thứ tự hiển thị</Label>
                <Input
                  type="number"
                  value={form.display_order ?? 0}
                  onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Đang hoạt động</Label>
            </div>
            <Button className="w-full" disabled={saving} onClick={save}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Cập nhật' : 'Tạo gói'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
