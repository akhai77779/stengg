import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi, enUS, zhCN, th, ja, ko, id as idLocale, ms, type Locale } from 'date-fns/locale';
import { Calendar, Target, Heart, Loader2 } from 'lucide-react';

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
}

export default function Charity() {
  const [programs, setPrograms] = useState<CharityProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchPrograms();
    }
  }, [user]);

  const fetchPrograms = async () => {
    const { data, error } = await supabase
      .from('charity_programs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching charity programs:', error);
    } else {
      setPrograms(data || []);
    }
    setIsLoading(false);
  };

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  // Placeholder data
  const placeholderPrograms: CharityProgram[] = [
    {
      id: '1',
      title: t('charity.programTitle1') || 'Vì trẻ em vùng cao',
      description: t('charity.programDesc1') || 'Chương trình hỗ trợ giáo dục cho trẻ em vùng cao, cung cấp sách vở, đồ dùng học tập và xây dựng điểm trường.',
      image_url: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&h=300&fit=crop',
      target_amount: 500000000,
      current_amount: 325000000,
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      is_active: true,
    },
    {
      id: '2',
      title: t('charity.programTitle2') || 'Mùa đông ấm áp',
      description: t('charity.programDesc2') || 'Quyên góp áo ấm, chăn và nhu yếu phẩm cho người dân vùng lạnh trong mùa đông.',
      image_url: 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=400&h=300&fit=crop',
      target_amount: 200000000,
      current_amount: 180000000,
      start_date: '2025-11-01',
      end_date: '2026-02-28',
      is_active: true,
    },
    {
      id: '3',
      title: t('charity.programTitle3') || 'Nước sạch cho cộng đồng',
      description: t('charity.programDesc3') || 'Xây dựng hệ thống lọc nước và giếng khoan cho các vùng khan hiếm nước sạch.',
      image_url: 'https://images.unsplash.com/photo-1541544537156-7627a7a4aa1c?w=400&h=300&fit=crop',
      target_amount: 800000000,
      current_amount: 420000000,
      start_date: '2026-01-15',
      end_date: '2026-12-31',
      is_active: true,
    },
  ];

  const displayPrograms = programs.length > 0 ? programs : placeholderPrograms;

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-3 md:px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-pink-500/20 mb-4">
            <Heart className="w-7 h-7 md:w-8 md:h-8 text-pink-400" />
          </div>
          <h1 className="text-2xl md:text-4xl font-bold mb-2">
            <span className="text-gradient">{t('charity.title')}</span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
            {t('charity.description')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-12">
          <Card className="bg-card border-border text-center p-3 md:p-6">
            <div className="text-xl md:text-3xl font-bold text-primary mb-1 md:mb-2">
              {displayPrograms.filter(p => p.is_active).length}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground">{t('charity.activePrograms')}</div>
          </Card>
          <Card className="bg-card border-border text-center p-3 md:p-6">
            <div className="text-sm md:text-3xl font-bold text-secondary mb-1 md:mb-2 truncate">
              {formatCurrency(displayPrograms.reduce((sum, p) => sum + p.current_amount, 0))}
            </div>
            <div className="text-xs md:text-sm text-muted-foreground">{t('charity.totalDonations')}</div>
          </Card>
          <Card className="bg-card border-border text-center p-3 md:p-6">
            <div className="text-xl md:text-3xl font-bold text-pink-400 mb-1 md:mb-2">
              1,234+
            </div>
            <div className="text-xs md:text-sm text-muted-foreground">{t('charity.peopleHelped')}</div>
          </Card>
        </div>

        {/* Programs Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {displayPrograms.map((program) => (
              <Card 
                key={program.id} 
                className="bg-card border-border overflow-hidden hover:border-primary/50 transition-all duration-200 active:scale-[0.99] touch-action-manipulation"
              >
                <div className="relative h-40 md:h-48 overflow-hidden">
                  <img
                    src={program.image_url || 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=400&h=300&fit=crop'}
                    alt={program.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <Badge 
                    variant="outline" 
                    className={`absolute top-3 right-3 ${
                      program.is_active 
                        ? 'bg-green-500/20 text-green-400 border-green-500/50' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {program.is_active ? t('charity.ongoing') : t('charity.ended')}
                  </Badge>
                </div>

                <CardContent className="p-3 md:p-4">
                  <h3 className="font-semibold text-base md:text-lg text-foreground mb-2">
                    {program.title}
                  </h3>
                  {program.description && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-4">
                      {program.description}
                    </p>
                  )}

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs md:text-sm">
                      <span className="text-muted-foreground">{t('charity.progress')}</span>
                      <span className="text-primary font-medium">
                        {getProgress(program.current_amount, program.target_amount).toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={getProgress(program.current_amount, program.target_amount)} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground">
                      <span>{formatCurrency(program.current_amount)}</span>
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {t('charity.target')}: {formatCurrency(program.target_amount)}
                      </span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="px-3 md:px-4 pb-3 md:pb-4 pt-0">
                  {program.start_date && program.end_date && (
                    <span className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(program.start_date), 'dd/MM/yyyy', { locale: dateLocales[language] || vi })} - {format(new Date(program.end_date), 'dd/MM/yyyy', { locale: dateLocales[language] || vi })}
                    </span>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}