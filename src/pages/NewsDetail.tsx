import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar, ArrowLeft, Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

type NewsCategory = Database['public']['Enums']['news_category'];

interface NewsItem {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  image_url: string | null;
  category: NewsCategory;
  created_at: string;
  author_id: string | null;
}


const categoryColors: Record<NewsCategory, string> = {
  company: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  product: 'bg-green-500/20 text-green-400 border-green-500/50',
  event: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  announcement: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  charity: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
};

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const categoryLabels: Record<NewsCategory, string> = {
    company: t('news.category.company'),
    product: t('news.category.product'),
    event: t('news.category.event'),
    announcement: t('news.category.announcement'),
    charity: t('news.category.charity'),
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchNews();
    }
  }, [user, id]);

  const fetchNews = async () => {
    if (!id) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching news:', error);
      setNotFound(true);
    } else if (!data) {
      setNotFound(true);
    } else {
      setNews(data);
    }

    setIsLoading(false);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </Layout>
    );
  }

  if (notFound || !news) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              Không tìm thấy tin tức
            </h1>
            <p className="text-muted-foreground mb-6">
              Tin tức bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.
            </p>
            <Button asChild>
              <Link to="/news">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Quay lại danh sách tin tức
              </Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/news" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
        </Button>

        <div className="relative h-64 md:h-96 rounded-xl overflow-hidden mb-8">
          <img
            src={news.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=600&fit=crop'}
            alt={news.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <Badge 
              variant="outline" 
              className={`${categoryColors[news.category]} mb-3`}
            >
              {categoryLabels[news.category]}
            </Badge>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground">
              {news.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border">
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {format(new Date(news.created_at), "dd MMMM, yyyy", { locale: vi })}
          </span>
        </div>

        {news.summary && (
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <p className="text-lg text-muted-foreground italic">
              {news.summary}
            </p>
          </div>
        )}

        <div className="prose prose-invert max-w-none">
          {news.content.split('\n').map((paragraph, index) => (
            <p key={index} className="text-foreground leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <Button asChild>
            <Link to="/news">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('news.viewMore')}
            </Link>
          </Button>
        </div>
      </article>
    </Layout>
  );
}
