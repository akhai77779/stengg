import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';

type NewsCategory = Database['public']['Enums']['news_category'];

interface News {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  image_url: string | null;
  category: NewsCategory;
  is_featured: boolean;
  views: number;
  created_at: string;
}

const categories: NewsCategory[] = ['company', 'product', 'event', 'announcement', 'charity'];

export function DashboardNews() {
  const { t } = useLanguage();
  
  const categoryLabels: Record<NewsCategory, string> = {
    company: t('news.category.company'),
    product: t('news.category.product'),
    event: t('news.category.event'),
    announcement: t('news.category.announcement'),
    charity: t('news.category.charity'),
  };
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState<NewsCategory>('company');
  const [isFeatured, setIsFeatured] = useState(false);
  const [createdAt, setCreatedAt] = useState('');

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching news:', error);
    } else {
      setNews(data || []);
    }
    setIsLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setSummary('');
    setContent('');
    setImageUrl('');
    setCategory('company');
    setIsFeatured(false);
    setCreatedAt('');
    setEditingNews(null);
  };

  const handleEdit = (item: News) => {
    setEditingNews(item);
    setTitle(item.title);
    setSummary(item.summary || '');
    setContent(item.content);
    setImageUrl(item.image_url || '');
    setCategory(item.category);
    setIsFeatured(item.is_featured);
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const d = new Date(item.created_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    setCreatedAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title || !content) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng điền tiêu đề và nội dung.',
      });
      return;
    }

    setIsSaving(true);

    const newsData: any = {
      title,
      summary: summary || null,
      content,
      image_url: imageUrl || null,
      category,
      is_featured: isFeatured,
      author_id: user?.id,
    };

    if (createdAt) {
      newsData.created_at = new Date(createdAt).toISOString();
    }

    let error;

    if (editingNews) {
      const result = await supabase
        .from('news')
        .update(newsData)
        .eq('id', editingNews.id);
      error = result.error;
    } else {
      const result = await supabase.from('news').insert(newsData);
      error = result.error;
    }

    setIsSaving(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể lưu tin tức. Vui lòng thử lại.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: editingNews ? 'Tin tức đã được cập nhật.' : 'Tin tức đã được tạo.',
    });

    setIsDialogOpen(false);
    resetForm();
    fetchNews();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tin tức này?')) return;

    const { error } = await supabase.from('news').delete().eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa tin tức.',
      });
      return;
    }

    toast({
      title: 'Thành công',
      description: 'Tin tức đã được xóa.',
    });

    fetchNews();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quản lý Tin tức</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Thêm tin tức
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingNews ? 'Chỉnh sửa tin tức' : 'Thêm tin tức mới'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tiêu đề *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề tin tức"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Tóm tắt</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Nhập tóm tắt ngắn gọn"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Nội dung *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Nhập nội dung chi tiết"
                  rows={6}
                />
              </div>

              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                folder="news"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Danh mục</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as NewsCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {categoryLabels[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nổi bật</Label>
                  <div className="flex items-center gap-2 pt-2">
                    <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
                    <span className="text-sm text-muted-foreground">
                      {isFeatured ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="created_at">Ngày tạo</Label>
                <Input
                  id="created_at"
                  type="datetime-local"
                  value={createdAt}
                  onChange={(e) => setCreatedAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Để trống nếu muốn dùng ngày hiện tại. Áp dụng cho cả tạo mới và chỉnh sửa.
                </p>
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
        ) : news.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Chưa có tin tức nào.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {news.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-xs truncate font-medium">
                    {item.title}
                    {item.is_featured && (
                      <Badge variant="secondary" className="ml-2">Nổi bật</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{categoryLabels[item.category]}</Badge>
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
