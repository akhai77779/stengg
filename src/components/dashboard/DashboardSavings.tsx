import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, PiggyBank } from 'lucide-react';
import { format } from 'date-fns';

interface SavingsPackage {
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
  display_order: number;
  created_at: string;
}

const toLocalDateTimeInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function DashboardSavings() {
  const [packages, setPackages] = useState<SavingsPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsPackage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cycleMonths, setCycleMonths] = useState('3');
  const [interestRate, setInterestRate] = useState('12');
  const [minDeposit, setMinDeposit] = useState('100');
  const [maxPool, setMaxPool] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => { fetchPackages(); }, []);

  const fetchPackages = async () => {
    const { data, error } = await supabase
      .from('savings_packages')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching packages:', error);
    else setPackages(data || []);
    setIsLoading(false);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setImageUrl('');
    setCycleMonths('3'); setInterestRate('12'); setMinDeposit('100');
    setMaxPool('0'); setCurrency('USD');
    setEventStart(''); setEventEnd(''); setDisplayOrder('0'); setIsActive(true);
    setEditing(null);
  };

  const handleEdit = (item: SavingsPackage) => {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description || '');
    setImageUrl(item.image_url || '');
    setCycleMonths(String(item.cycle_months));
    setInterestRate(String(item.interest_rate_percent));
    setMinDeposit(String(item.min_deposit_amount));
    setMaxPool(String(item.max_total_pool));
    setCurrency(item.currency || 'USD');
    setEventStart(toLocalDateTimeInput(item.event_start_at));
    setEventEnd(toLocalDateTimeInput(item.event_end_at));
    setDisplayOrder(String(item.display_order ?? 0));
    setIsActive(item.is_active);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng nhập tiêu đề.' });
      return;
    }
    setIsSaving(true);

    const data = {
      title,
      description: description || null,
      image_url: imageUrl || null,
      cycle_months: parseInt(cycleMonths) || 1,
      interest_rate_percent: parseFloat(interestRate) || 0,
      min_deposit_amount: parseFloat(minDeposit) || 0,
      max_total_pool: parseFloat(maxPool) || 0,
      currency: currency || 'USD',
      event_start_at: eventStart ? new Date(eventStart).toISOString() : null,
      event_end_at: eventEnd ? new Date(eventEnd).toISOString() : null,
      display_order: parseInt(displayOrder) || 0,
      is_active: isActive,
    };

    let error;
    if (editing) {
      const r = await supabase.from('savings_packages').update(data).eq('id', editing.id);
      error = r.error;
    } else {
      const r = await supabase.from('savings_packages').insert(data);
      error = r.error;
    }
    setIsSaving(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: error.message });
      return;
    }
    toast({ title: 'Thành công', description: editing ? 'Đã cập nhật gói.' : 'Đã tạo gói.' });
    setIsDialogOpen(false);
    resetForm();
    fetchPackages();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá gói này? Các deposits của user vẫn được giữ lại.')) return;
    const { error } = await supabase.from('savings_packages').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: error.message });
      return;
    }
    toast({ title: 'Đã xoá' });
    fetchPackages();
  };

  const getProgress = (current: number, max: number) => {
    if (!max || max === 0) return 0;
    return Math.min((current / max) * 100, 100);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-primary" />
          Quản lý Gói tiết kiệm
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="w-4 h-4 mr-2" /> Thêm gói
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? 'Chỉnh sửa gói tiết kiệm' : 'Thêm gói tiết kiệm mới'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vd: Gói tiết kiệm 3 tháng - 12%" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>

              <ImageUpload value={imageUrl} onChange={setImageUrl} folder="savings" />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cycleMonths">Kỳ hạn (tháng) *</Label>
                  <Input id="cycleMonths" type="number" value={cycleMonths} onChange={(e) => setCycleMonths(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interestRate">Lãi suất (%) *</Label>
                  <Input id="interestRate" type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Tiền tệ</Label>
                  <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minDeposit">Tối thiểu/lần</Label>
                  <Input id="minDeposit" type="number" value={minDeposit} onChange={(e) => setMinDeposit(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPool">Tổng quỹ tối đa (0 = không giới hạn)</Label>
                  <Input id="maxPool" type="number" value={maxPool} onChange={(e) => setMaxPool(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eventStart">Bắt đầu sự kiện</Label>
                  <Input id="eventStart" type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventEnd">Kết thúc sự kiện</Label>
                  <Input id="eventEnd" type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Thứ tự hiển thị</Label>
                  <Input id="displayOrder" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Trạng thái</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                    <span className="text-sm text-muted-foreground">{isActive ? 'Hoạt động' : 'Tạm dừng'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Hủy</Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-primary">
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Đang lưu...</> : 'Lưu'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : packages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Chưa có gói tiết kiệm nào.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Lãi suất / Kỳ hạn</TableHead>
                <TableHead>Tiến độ quỹ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Tạo lúc</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-xs truncate font-medium">{item.title}</TableCell>
                  <TableCell>
                    <span className="text-success font-semibold">{item.interest_rate_percent}%</span>
                    <span className="text-muted-foreground"> / {item.cycle_months}m</span>
                  </TableCell>
                  <TableCell>
                    <div className="w-32 space-y-1">
                      {item.max_total_pool > 0 ? (
                        <>
                          <Progress value={getProgress(item.current_pool, item.max_total_pool)} className="h-2" />
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {item.current_pool.toLocaleString()} / {item.max_total_pool.toLocaleString()}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {item.current_pool.toLocaleString()} {item.currency}
                          <div>(không giới hạn)</div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={item.is_active ? 'bg-green-500/20 text-green-400' : ''}>
                      {item.is_active ? 'Hoạt động' : 'Tạm dừng'}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(item.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
