import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSync } from '@/hooks/useAutoSync';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Activity, Loader2, Plane, Cpu, Car, Ship, Shield, Building2, GraduationCap, Briefcase, Satellite, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
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
export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const {
    user,
    isLoading: authLoading
  } = useAuth();
  const {
    t,
    language
  } = useLanguage();
  const {
    formatCurrency
  } = useCurrency();
  const navigate = useNavigate();
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);
  // Auto-sync external data every 3 seconds and refresh products list
  useAutoSync({ 
    enabled: !!user,
    interval: 3000,
    onSuccess: () => {
      // Refresh products after sync
      if (user) fetchProducts();
    }
  });

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);
  const fetchProducts = async () => {
    setIsLoading(true);
    const {
      data,
      error
    } = await supabase.from('products').select('id, name, description, image_url, price, volume, turnover, price_change, category').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
      // Calculate total volume
      const total = (data || []).reduce((sum, p) => {
        const vol = parseFloat(p.volume?.replace(/[^0-9.]/g, '') || '0');
        return sum + vol;
      }, 0);
      setTotalVolume(total);
    }
    setIsLoading(false);
  };
  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return formatCurrency(0);
    return formatCurrency(price);
  };
  const formatVolume = (volume: string | null, turnover: string | null) => {
    // Prefer turnover (trading volume in currency) over volume
    const value = turnover || volume;
    if (!value || value === '0' || value === 'null') return '-';
    
    // Format large numbers with K, M, B suffixes
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
  const getLocalizedDate = () => {
    const locales: Record<string, string> = {
      vi: 'vi-VN',
      en: 'en-US',
      zh: 'zh-CN',
      th: 'th-TH',
      ja: 'ja-JP',
      ko: 'ko-KR',
      id: 'id-ID',
      ms: 'ms-MY'
    };
    return new Date().toLocaleString(locales[language] || 'vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  return <Layout>
      <div className="min-h-screen pb-20 md:pb-8 my-0">
        {/* Header */}
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 sticky top-0 md:top-16 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-lg md:text-xl font-bold text-gradient mb-2 text-center">{t('products.title')}</h1>
            
            {/* Stock ticker info */}
            <div className="gap-2 text-xs text-muted-foreground mb-2 flex items-center justify-center">
              <span>Singapore Technologies Engineering</span>
            </div>
            
          </div>
        </div>

        {/* Products List */}
        <div className="container mx-auto px-3 md:px-4 py-4">
          {isLoading ? <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div> : products.length === 0 ? <div className="text-center py-12">
              <p className="text-muted-foreground">{t('products.noProducts')}</p>
            </div> : <div className="grid gap-3">
              {products.map(product => {
            const isPositive = (product.price_change || 0) >= 0;
            return <Card key={product.id} className="group bg-card border-border hover:border-primary/30 transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.99] touch-action-manipulation" onClick={() => navigate(`/products/${product.id}`)}>
                    {/* Product Image - Full Width with Hover Zoom */}
                    {product.image_url ? <div className="w-full h-28 md:h-40 overflow-hidden">
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                          decoding="async"
                        />
                      </div> : <div className="w-full h-28 md:h-40 bg-muted/30 flex items-center justify-center">
                        {getCategoryIcon(product.name, product.category)}
                      </div>}
                    
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center gap-3 md:gap-4">
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm md:text-base line-clamp-1 mb-1">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>24HVOL:</span>
                            <span className="text-foreground">{formatVolume(product.volume, product.turnover)}</span>
                          </div>
                        </div>
                        
                        {/* Price & Change */}
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-base md:text-lg font-bold text-foreground">
                            {formatPrice(product.price)}
                          </span>
                          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            <span>{formatChange(product.price_change)}%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>;
          })}
            </div>}
        </div>
      </div>
    </Layout>;
}