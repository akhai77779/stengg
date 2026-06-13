import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PageSeo } from '@/components/seo/PageSeo';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi, enUS, zhCN, th, ja, ko, id as idLocale, ms, type Locale } from 'date-fns/locale';
import { Calendar, Search, Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type NewsCategory = Database['public']['Enums']['news_category'];

interface News {
  id: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  category: NewsCategory;
  created_at: string;
}

const categoryColors: Record<NewsCategory, string> = {
  company: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  product: 'bg-green-500/20 text-green-400 border-green-500/50',
  event: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  announcement: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  charity: 'bg-pink-500/20 text-pink-400 border-pink-500/50',
};

const categories: NewsCategory[] = ['company', 'product', 'event', 'announcement', 'charity'];

export default function News() {
  const [news, setNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'all'>('all');
  const { user, isLoading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const dateLocales: Record<string, Locale> = {
    vi: vi,
    en: enUS,
    zh: zhCN,
    th: th,
    ja: ja,
    ko: ko,
    id: idLocale,
    ms: ms,
  };

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
    if (user) {
      fetchNews();
    }
  }, [user, selectedCategory]);

  const fetchNews = async () => {
    setIsLoading(true);
    let query = supabase
      .from('news')
      .select('id, title, summary, image_url, category, created_at')
      .order('created_at', { ascending: false });

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching news:', error);
    } else {
      setNews(data || []);
    }
    setIsLoading(false);
  };

  const filteredNews = news.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <PageSeo
        title="News & Announcements — ST Engineering"
        description="Latest news, press releases, and announcements from ST Engineering across Aerospace, Defence, Smart City and Digital."
        path="/news"
      />
      <div className="container mx-auto px-3 md:px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold mb-2">
            <span className="text-gradient">{t('news.title')}</span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('news.subtitle')}
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('news.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "shrink-0 text-xs md:text-sm h-9 md:h-11",
                selectedCategory === 'all' ? 'bg-gradient-primary' : ''
              )}
            >
              {t('common.all')}
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "shrink-0 text-xs md:text-sm h-9 md:h-11",
                  selectedCategory === cat ? 'bg-gradient-primary' : ''
                )}
              >
                {categoryLabels[cat]}
              </Button>
            ))}
          </div>
        </div>

        {/* News Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredNews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('news.noNews')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredNews.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`}>
                <Card className="group bg-card border-border hover:border-primary/50 transition-all duration-200 overflow-hidden h-full active:scale-[0.99] touch-action-manipulation">
                  <div className="relative h-40 md:h-48 overflow-hidden">
                    <img
                      src={item.image_url || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=250&fit=crop'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    <Badge 
                      variant="outline" 
                      className={`absolute top-3 left-3 ${categoryColors[item.category]}`}
                    >
                      {categoryLabels[item.category]}
                    </Badge>
                  </div>

                  <CardContent className="p-3 md:p-4">
                    <h3 className="font-semibold text-sm md:text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="px-3 md:px-4 pb-3 md:pb-4 pt-0 flex items-center text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: dateLocales[language] || vi })}
                    </span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}