import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type ProductStatus = Database['public']['Enums']['product_status'];
type ProductPriceControlRow = Database['public']['Tables']['product_price_controls']['Row'];

type PriceDirection = 'up' | 'down' | 'neutral';

const directionOptions: { value: PriceDirection; label: string }[] = [
  { value: 'up', label: 'Up (Tăng)' },
  { value: 'down', label: 'Down (Giảm)' },
  { value: 'neutral', label: 'Neutral (Trung tính)' },
];

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  status: ProductStatus;
  category: string | null;
  created_at: string;
}

const statusLabels: Record<ProductStatus, string> = {
  available: 'Có sẵn',
  sold: 'Đã bán',
  pending: 'Chờ xử lý',
};

const statusColors: Record<ProductStatus, string> = {
  available: 'bg-green-500/20 text-green-400',
  sold: 'bg-red-500/20 text-red-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
};

const statuses: ProductStatus[] = ['available', 'sold', 'pending'];

export function DashboardProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [priceControls, setPriceControls] = useState<
    Record<string, { direction: PriceDirection; strength: string; saving?: boolean }>
  >({});

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState<ProductStatus>('available');
  const [category, setCategory] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
      const ids = (data || []).map((p) => p.id);
      if (ids.length) {
        await fetchPriceControls(ids);
      } else {
        setPriceControls({});
      }
    }
    setIsLoading(false);
  };

  const fetchPriceControls = async (productIds: string[]) => {
    const { data, error } = await supabase
      .from('product_price_controls')
      .select('product_id,direction,strength')
      .in('product_id', productIds);

    if (error) {
      console.error('Error fetching product price controls:', error);
      // Fallback: still initialize defaults so UI doesn't look broken.
      setPriceControls((prev) => {
        const next = { ...prev };
        for (const id of productIds) {
          if (!next[id]) next[id] = { direction: 'neutral', strength: '1' };
        }
        return next;
      });
      return;
    }

    const rows = (data || []) as Pick<ProductPriceControlRow, 'product_id' | 'direction' | 'strength'>[];

    setPriceControls(() => {
      const next: Record<string, { direction: PriceDirection; strength: string }> = {};
      for (const id of productIds) {
        next[id] = { direction: 'neutral', strength: '1' };
      }
      for (const r of rows) {
        const dir = (r.direction as PriceDirection) || 'neutral';
        next[r.product_id] = {
          direction: dir,
          strength: String(r.strength ?? 1),
        };
      }
      return next;
    });
  };

  const clampStrength = (value: number) => {
    if (Number.isNaN(value)) return 1;
    return Math.min(5, Math.max(0, value));
  };

  const savePriceControl = async (productId: string, patch: Partial<{ direction: PriceDirection; strength: string }>) => {
    const current = priceControls[productId] || { direction: 'neutral' as PriceDirection, strength: '1' };
    const next = { ...current, ...patch };

    const strengthNumber = clampStrength(parseFloat(next.strength));

    setPriceControls((prev) => ({
      ...prev,
      [productId]: { ...next, strength: String(next.strength), saving: true },
    }));

    const { error } = await supabase
      .from('product_price_controls')
      .upsert(
        {
          product_id: productId,
          direction: next.direction,
          strength: strengthNumber,
        },
        { onConflict: 'product_id' }
      );

    if (error) {
      console.error('Error saving product price control:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể lưu direction/strength. Vui lòng thử lại.',
      });
      setPriceControls((prev) => ({
        ...prev,
        [productId]: { ...current, saving: false },
      }));
      return;
    }

    setPriceControls((prev) => ({
      ...prev,
      [productId]: { ...next, strength: String(strengthNumber), saving: false },
    }));
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setImageUrl('');
    setPrice('');
    setStatus('available');
    setCategory('');
    setEditingProduct(null);
  };

  const handleEdit = (item: Product) => {
    setEditingProduct(item);
    setName(item.name);
    setDescription(item.description || '');
    setImageUrl(item.image_url || '');
    setPrice(item.price?.toString() || '');
    setStatus(item.status);
    setCategory(item.category || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng điền tên sản phẩm.',
      });
      return;
    }

    setIsSaving(true);

    const productData = {
      name,
      description: description || null,
      image_url: imageUrl || null,
      price: price ? parseFloat(price) : null,
      status,
      category: category || null,
      created_by: user?.id,
    };

    let error;

    if (editingProduct) {
      const result = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id);
      error = result.error;
    } else {
      const result = await supabase.from('products').insert(productData);
      error = result.error;
    }

    setIsSaving(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể lưu sản phẩm. Vui lòng thử lại.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: editingProduct ? 'Sản phẩm đã được cập nhật.' : 'Sản phẩm đã được tạo.',
    });

    setIsDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;

    const { error } = await supabase.from('products').delete().eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa sản phẩm.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: 'Sản phẩm đã được xóa.',
    });

    fetchProducts();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} sản phẩm đã chọn?`)) return;

    setIsDeleting(true);

    const { error } = await supabase
      .from('products')
      .delete()
      .in('id', Array.from(selectedIds));

    setIsDeleting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa các sản phẩm đã chọn.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: `Đã xóa ${selectedIds.size} sản phẩm.`,
    });

    setSelectedIds(new Set());
    fetchProducts();
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const formatPrice = (price: number | null) => {
    if (!price) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <CardTitle>Quản lý Sản phẩm</CardTitle>
          {selectedIds.size > 0 && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Xóa {selectedIds.size} sản phẩm
            </Button>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Thêm sản phẩm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên sản phẩm *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên sản phẩm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả sản phẩm"
                  rows={3}
                />
              </div>

              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="products"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Giá (VND)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Danh mục</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="IoT, Hardware, ..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Trạng thái</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Chưa có sản phẩm nào.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={products.length > 0 && selectedIds.size === products.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Giá</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Strength</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((item) => (
                <TableRow key={item.id} className={selectedIds.has(item.id) ? 'bg-muted/50' : ''}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-medium">{item.name}</TableCell>
                  <TableCell>{item.category || '-'}</TableCell>
                  <TableCell>{formatPrice(item.price)}</TableCell>
                  <TableCell>
                    <Select
                      value={(priceControls[item.id]?.direction ?? 'neutral') as PriceDirection}
                      onValueChange={(v) => savePriceControl(item.id, { direction: v as PriceDirection })}
                    >
                      <SelectTrigger className="h-9 w-[160px]">
                        <SelectValue placeholder="Chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        {directionOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={5}
                        step={0.1}
                        className="h-9 w-[110px]"
                        value={priceControls[item.id]?.strength ?? '1'}
                        onChange={(e) =>
                          setPriceControls((prev) => ({
                            ...prev,
                            [item.id]: {
                              direction: (prev[item.id]?.direction ?? 'neutral') as PriceDirection,
                              strength: e.target.value,
                            },
                          }))
                        }
                        onBlur={() => savePriceControl(item.id, { strength: priceControls[item.id]?.strength ?? '1' })}
                      />
                      {priceControls[item.id]?.saving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[item.status]}>
                      {statusLabels[item.status]}
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
