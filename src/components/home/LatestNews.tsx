import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Database } from '@/integrations/supabase/types';

type NewsCategory = Database['public']['Enums']['news_category'];

interface News {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  category: NewsCategory;
  views: number;
  created_at: string;
}

const categoryLabels: Record<NewsCategory, string> = {
  company: 'Công ty',
  product: 'Sản phẩm',
  event: 'Sự kiện',
  announcement: 'Thông báo',
  charity: 'Từ thiện',
};

const categoryColors: Record<NewsCategory, string> = {
  company: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  product: 'bg-green-500/20 text-green-400 border-green-500/50',
  event: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  announcement: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  charity: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
};

export function LatestNews() {
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from('news')
      .select('id, title, summary, image_url, category, views, created_at')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('Error fetching news:', error);
    } else {
      setNews(data || []);
    }
    setIsLoading(false);
  };

  // Placeholder data for empty state
  const placeholderNews: News[] = [
    {
      id: '1',
      title: 'ST Engineering ra mắt giải pháp Smart City mới',
      summary: 'Giải pháp công nghệ thông minh giúp tối ưu hóa quản lý đô thị hiện đại.',
      image_url: 'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=400&h=250&fit=crop',
      category: 'product',
      views: 156,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Hội nghị nhân viên ST Engineering 2026',
      summary: 'Sự kiện quy tụ hơn 1000 nhân viên từ các chi nhánh trên toàn cầu.',
      image_url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=250&fit=crop',
      category: 'event',
      views: 234,
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'Chương trình từ thiện "Vì trẻ em vùng cao"',
      summary: 'ST Engineering quyên góp hỗ trợ giáo dục cho trẻ em vùng cao.',
      image_url: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&h=250&fit=crop',
      category: 'charity',
      views: 189,
      created_at: new Date().toISOString(),
    },
  ];

  const displayNews = news.length > 0 ? news : placeholderNews;

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">
              <span className="text-gradient">Tin tức mới nhất</span>
            </h2>
            <p className="text-muted-foreground mt-2">
              Cập nhật thông tin mới nhất từ ST Engineering
            </p>
          </div>
          <Button variant="ghost" asChild className="hidden md:flex">
            <Link to="/news" className="flex items-center gap-2">
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* News Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-border animate-pulse">
                <div className="h-48 bg-muted" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-6 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayNews.map((item, index) => (
              <Link key={item.id} to={`/news/${item.id}`}>
                <Card 
                  className="group bg-card border-border hover:border-primary/50 hover:glow transition-all duration-300 overflow-hidden h-full"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={item.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=250&fit=crop'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 hero-overlay" />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <Badge 
                      variant="outline" 
                      className={`absolute top-3 left-3 ${categoryColors[item.category]}`}
                    >
                      {categoryLabels[item.category]}
                    </Badge>
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="px-4 pb-4 pt-0 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {item.views}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Mobile View All Button */}
        <div className="mt-8 text-center md:hidden">
          <Button asChild>
            <Link to="/news" className="flex items-center gap-2">
              Xem tất cả tin tức
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
