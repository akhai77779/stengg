import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Activity, Loader2, Plane, Cpu, Car, Ship, Shield, Building2, GraduationCap, Briefcase, Satellite, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MiniCandleChart } from '@/components/product/MiniCandleChart';
import { AnimatedPrice } from '@/components/product/AnimatedPrice';

const getCategoryIcon = (name: string, category: string | null) => {
  const iconClass = "w-10 h-10 p-2 rounded-lg";
  if (name.includes('Aerospace') || category === 'Aerospace') {
    return <Plane className={cn(iconClass, "bg-blue-500/20 text-blue-400")} />;
  }
  if (name.includes('Electronics') || category === 'Electronics') {
    return <Cpu className={cn(iconClass, "bg-purple-500/20 text-purple-400")} />;
  }
  if (name.includes('Land') || category === 'Land Systems') {
    return <Car className={cn(iconClass, "bg-amber-500/20 text-amber-400")} />;
  }
  if (name.includes('Marine') || category === 'Marine') {
    return <Ship className={cn(iconClass, "bg-cyan-500/20 text-cyan-400")} />;
  }
  if (name.includes('Defence') || category === 'Defence') {
    return <Shield className={cn(iconClass, "bg-red-500/20 text-red-400")} />;
  }
  if (name.includes('Smart City') || category === 'Smart City') {
    return <Building2 className={cn(iconClass, "bg-emerald-500/20 text-emerald-400")} />;
  }
  if (name.includes('Training') || category === 'Training') {
    return <GraduationCap className={cn(iconClass, "bg-orange-500/20 text-orange-400")} />;
  }
  if (name.includes('Commercial') || category === 'Commercial') {
    return <Briefcase className={cn(iconClass, "bg-indigo-500/20 text-indigo-400")} />;
  }
  if (name.includes('iDirect') || category === 'iDirect') {
    return <Satellite className={cn(iconClass, "bg-pink-500/20 text-pink-400")} />;
  }
  if (name.includes('Research') || category === 'Research') {
    return <FlaskConical className={cn(iconClass, "bg-teal-500/20 text-teal-400")} />;
  }
  return <Activity className={cn(iconClass, "bg-primary/20 text-primary")} />;
};

interface CandleRow {
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  product_id: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  volume: string | null;
  turnover: string | null;
  price_change: number | null;
  category: string | null;
}

interface ProductWithChart extends Product {
  candles: CandleRow[];
}

export default function Products() {
  const [products, setProducts] = useState<ProductWithChart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, image_url, price, volume, turnover, price_change, category')
      .order('created_at', { ascending: false });

    if (error || !data) {
      setIsLoading(false);
      return;
    }

    // Initialize products without chart data first (fast render)
    setProducts(data.map(p => ({ ...p, candles: [] })));
    setIsLoading(false);

    // Batch fetch last 30 candles for all products in ONE query
    const productIds = data.map(p => p.id);
    if (productIds.length === 0) return;

    const { data: allCandles } = await supabase
      .from('price_history')
      .select('product_id, open_price, high_price, low_price, close_price, recorded_at')
      .in('product_id', productIds)
      .order('recorded_at', { ascending: false })
      .limit(30 * productIds.length);

    if (!allCandles) return;

    // Group by product_id (keep last 30 each, re-sort ascending for chart)
    const candleMap: Record<string, CandleRow[]> = {};
    for (const c of allCandles) {
      if (!candleMap[c.product_id]) candleMap[c.product_id] = [];
      if (candleMap[c.product_id].length < 30) {
        candleMap[c.product_id].push(c as CandleRow);
      }
    }
    // Reverse to ascending order
    for (const id of Object.keys(candleMap)) {
      candleMap[id].reverse();
    }

    setProducts(data.map(p => ({ ...p, candles: candleMap[p.id] || [] })));
  }, []);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user, fetchProducts]);

  // Realtime: update product prices
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('products-list-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        setProducts(prev => prev.map(p =>
          p.id === payload.new.id ? { ...p, ...(payload.new as Product) } : p
        ));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Realtime: update candle data when new price_history arrives
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('products-price-history')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_history' }, (payload) => {
        const row = payload.new as CandleRow & { recorded_at: string };
        if (!row?.product_id) return;
        setProducts(prev => prev.map(p => {
          if (p.id !== row.product_id) return p;
          const existing = p.candles.findIndex((c: CandleRow & { recorded_at?: string }) =>
            (c as unknown as { recorded_at: string }).recorded_at === row.recorded_at
          );
          const updated = existing >= 0
            ? p.candles.map((c, i) => i === existing ? row : c)
            : [...p.candles.slice(-29), row];
          return { ...p, candles: updated };
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return formatCurrency(0);
    return formatCurrency(price);
  };

  const formatVolume = (volume: string | null, turnover: string | null) => {
    const value = turnover || volume;
    if (!value || value === '0' || value === 'null') return '-';
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num === 0) return '-';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatChange = (change: number | null) => {
    if (change === null || change === undefined) return '0.00';
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pb-20 md:pb-8 my-0">
        {/* Header */}
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 sticky top-0 md:top-16 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-lg md:text-xl font-bold text-gradient mb-2 text-center">{t('products.title')}</h1>
            <div className="gap-2 text-xs text-muted-foreground mb-2 flex items-center justify-center">
              <span>Singapore Technologies Engineering</span>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="container mx-auto px-3 md:px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('products.noProducts')}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {products.map(product => {
                const isPositive = (product.price_change || 0) >= 0;
                const chartData = product.candles.map(c => ({
                  open: c.open_price,
                  high: c.high_price,
                  low: c.low_price,
                  close: c.close_price,
                }));

                return (
                  <Card
                    key={product.id}
                    className="group bg-card border-border hover:border-primary/30 transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.99]"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        {/* Left: thumbnail */}
                        <div className="w-16 md:w-20 flex-shrink-0">
                          {product.image_url ? (
                            <div className="h-full overflow-hidden">
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 min-h-[72px]"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          ) : (
                            <div className="h-full min-h-[72px] bg-muted/30 flex items-center justify-center">
                              {getCategoryIcon(product.name, product.category)}
                            </div>
                          )}
                        </div>

                        {/* Middle: info */}
                        <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
                          <h3 className="font-semibold text-foreground text-sm md:text-base line-clamp-1 mb-1">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>24HVOL:</span>
                            <span className="text-foreground">{formatVolume(product.volume, product.turnover)}</span>
                          </div>
                          {/* Price row (mobile) */}
                          <div className="flex items-center gap-2 mt-1 md:hidden">
                            <AnimatedPrice
                              value={product.price}
                              formatter={formatPrice}
                              className="text-base font-bold tabular-nums"
                            />
                            <div className={cn(
                              'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium',
                              isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            )}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              <span>{formatChange(product.price_change)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: mini candle chart + price (desktop) */}
                        <div className="flex items-center gap-3 pr-3 py-2">
                          {/* Candle chart */}
                          <div className="flex-shrink-0">
                            {chartData.length >= 2 ? (
                              <MiniCandleChart
                                data={chartData}
                                width={100}
                                height={52}
                                className="opacity-90 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-[100px] h-[52px] flex items-center justify-center">
                                <span className="text-xs text-muted-foreground/50">—</span>
                              </div>
                            )}
                          </div>

                          {/* Price + change (desktop only) */}
                          <div className="hidden md:flex flex-col items-end gap-1 min-w-[90px]">
                            <AnimatedPrice
                              value={product.price}
                              formatter={formatPrice}
                              className="text-base md:text-lg font-bold tabular-nums"
                            />
                            <div className={cn(
                              'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                              isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            )}>
                              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              <span>{formatChange(product.price_change)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
