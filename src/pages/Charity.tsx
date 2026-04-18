import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { ChevronRight, Loader2, Heart } from 'lucide-react';

interface CharityProgram {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  target_amount: number;
  current_amount: number;
  currency: string;
  cycle_days: number;
  interest_rate: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

export default function Charity() {
  const [programs, setPrograms] = useState<CharityProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<CharityProgram | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeSlide, setActiveSlide] = useState(0);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchPrograms();
  }, [user]);

  useEffect(() => {
    if (!carouselApi) return;
    setActiveSlide(carouselApi.selectedScrollSnap());
    carouselApi.on('select', () => setActiveSlide(carouselApi.selectedScrollSnap()));
  }, [carouselApi]);

  const fetchPrograms = async () => {
    const { data, error } = await supabase
      .from('charity_programs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching charity programs:', error);
    else setPrograms((data as CharityProgram[]) || []);
    setIsLoading(false);
  };

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  const heroPrograms = programs.filter(p => p.image_url).slice(0, 5);
  const heroProgram = programs[0];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-3xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t('charity.noPrograms') || 'Chưa có chương trình từ thiện'}</p>
          </div>
        ) : (
          <>
            {/* Hero Carousel */}
            {heroPrograms.length > 0 && (
              <div className="mb-4">
                <Carousel
                  setApi={setCarouselApi}
                  plugins={[Autoplay({ delay: 4500, stopOnInteraction: false })]}
                  opts={{ loop: true }}
                  className="w-full"
                >
                  <CarouselContent>
                    {heroPrograms.map(p => (
                      <CarouselItem key={p.id}>
                        <button
                          onClick={() => setSelected(p)}
                          className="w-full block rounded-xl overflow-hidden aspect-[16/10] relative"
                        >
                          <img
                            src={p.image_url!}
                            alt={p.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
                {/* Dot indicators */}
                <div className="flex justify-center gap-1.5 mt-3">
                  {heroPrograms.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => carouselApi?.scrollTo(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === activeSlide ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/40'
                      }`}
                      aria-label={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hero Title & description */}
            {heroProgram && (
              <div className="mb-6 px-1">
                <h1 className="text-lg md:text-xl font-bold text-foreground leading-snug mb-2">
                  {heroProgram.title}
                </h1>
                {heroProgram.description && (
                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {heroProgram.description}
                  </p>
                )}
              </div>
            )}

            {/* Section: All funds */}
            <h2 className="text-base md:text-lg font-bold text-foreground mb-3 px-1">
              {t('charity.allFunds') || 'Tất cả các quỹ'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {programs.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="text-left"
                >
                  <Card className="overflow-hidden bg-card border-border hover:border-primary/50 transition-all active:scale-[0.98] h-full flex flex-col">
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Heart className="w-8 h-8 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex-1 flex flex-col">
                      <p className="text-[11px] md:text-xs text-muted-foreground font-medium mb-1.5 line-clamp-1">
                        {p.title}
                      </p>
                      <h3 className="text-sm md:text-base font-bold text-foreground mb-2 line-clamp-2 leading-tight">
                        {p.title}
                      </h3>
                      <div className="space-y-1 text-[11px] md:text-xs text-muted-foreground mt-auto">
                        <div>
                          {t('charity.fundCurrency') || 'Tiền tệ quỹ'}: <span className="text-foreground">{p.currency}</span>
                        </div>
                        <div>
                          {t('charity.fundCycle') || 'Chu kỳ quỹ'}: <span className="text-foreground">{p.cycle_days} {t('charity.days') || 'ngày'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>
                            {t('charity.comprehensiveRate') || 'Lãi suất toàn diện'}:{' '}
                            <span className="text-success font-semibold">
                              {Number(p.interest_rate).toFixed(0)}%
                            </span>
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-left">{selected.title}</DialogTitle>
                {selected.description && (
                  <DialogDescription className="text-left whitespace-pre-line">
                    {selected.description}
                  </DialogDescription>
                )}
              </DialogHeader>
              {selected.image_url && (
                <img
                  src={selected.image_url}
                  alt={selected.title}
                  className="w-full rounded-lg mt-2"
                />
              )}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="text-muted-foreground mb-0.5">{t('charity.fundCurrency') || 'Tiền tệ'}</div>
                    <div className="font-semibold text-foreground">{selected.currency}</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="text-muted-foreground mb-0.5">{t('charity.fundCycle') || 'Chu kỳ'}</div>
                    <div className="font-semibold text-foreground">{selected.cycle_days}d</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="text-muted-foreground mb-0.5">{t('charity.comprehensiveRate') || 'Lãi suất'}</div>
                    <div className="font-semibold text-success">{Number(selected.interest_rate).toFixed(0)}%</div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{t('charity.progress')}</span>
                    <span className="text-primary font-medium">
                      {getProgress(selected.current_amount, selected.target_amount).toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={getProgress(selected.current_amount, selected.target_amount)} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{selected.current_amount.toLocaleString()} {selected.currency}</span>
                    <span>{selected.target_amount.toLocaleString()} {selected.currency}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
