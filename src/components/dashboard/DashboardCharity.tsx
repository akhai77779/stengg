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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface CharityProgram {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_amount: number;
  current_amount: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
}

export function DashboardCharity() {
  const [programs, setPrograms] = useState<CharityProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<CharityProgram | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    const { data, error } = await supabase
      .from('charity_programs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching programs:', error);
    } else {
      setPrograms(data || []);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImageUrl('');
    setTargetAmount('');
    setCurrentAmount('');
    setStartDate('');
    setEndDate('');
    setIsActive(true);
    setEditingProgram(null);
  };

  const handleEdit = (item: CharityProgram) => {
    setEditingProgram(item);
    setTitle(item.title);
    setDescription(item.description || '');
    setImageUrl(item.image_url || '');
    setTargetAmount(item.target_amount.toString());
    setCurrentAmount(item.current_amount.toString());
    setStartDate(item.start_date || '');
    setEndDate(item.end_date || '');
    setIsActive(item.is_active);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng điền tiêu đề chương trình.',
      });
      return;
    }

    setIsSaving(true);

    const programData = {
      title,
      description: description || null,
      image_url: imageUrl || null,
      target_amount: parseFloat(targetAmount) || 0,
      current_amount: parseFloat(currentAmount) || 0,
      start_date: startDate || null,
      end_date: endDate || null,
      is_active: isActive,
    };

    let error;

    if (editingProgram) {
      const result = await supabase
        .from('charity_programs')
        .update(programData)
        .eq('id', editingProgram.id);
      error = result.error;
    } else {
      const result = await supabase.from('charity_programs').insert(programData);
      error = result.error;
    }

    setIsSaving(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể lưu chương trình. Vui lòng thử lại.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: editingProgram ? 'Chương trình đã được cập nhật.' : 'Chương trình đã được tạo.',
    });

    setIsDialogOpen(false);
    resetForm();
    fetchPrograms();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chương trình này?')) return;

    const { error } = await supabase.from('charity_programs').delete().eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa chương trình.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: 'Chương trình đã được xóa.',
    });

    fetchPrograms();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quản lý Từ thiện</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Thêm chương trình
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProgram ? 'Chỉnh sửa chương trình' : 'Thêm chương trình mới'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề chương trình"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả chương trình"
                  rows={3}
                />
              </div>

              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="charity"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Mục tiêu (VND)</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentAmount">Đã quyên góp (VND)</Label>
                  <Input
                    id="currentAmount"
                    type="number"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Ngày bắt đầu</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">Ngày kết thúc</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <span className="text-sm text-muted-foreground">
                    {isActive ? 'Đang hoạt động' : 'Đã kết thúc'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-primary">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    'Lưu'
                  )}
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
        ) : programs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Chưa có chương trình từ thiện nào.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Tiến độ</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-xs truncate font-medium">{item.title}</TableCell>
                  <TableCell>
                    <div className="w-32 space-y-1">
                      <Progress value={getProgress(item.current_amount, item.target_amount)} className="h-2" />
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.current_amount)} / {formatCurrency(item.target_amount)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={item.is_active ? 'bg-green-500/20 text-green-400' : ''}>
                      {item.is_active ? 'Hoạt động' : 'Kết thúc'}
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
