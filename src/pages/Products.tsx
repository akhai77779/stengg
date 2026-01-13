import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, TrendingDown, Activity, Loader2,
  Plane, Cpu, Car, Ship, Shield, Building2, 
  GraduationCap, Briefcase, Satellite, FlaskConical
} from 'lucide-react';
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
  price_change: number | null;
  category: string | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);

  const fetchProducts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, image_url, price, volume, price_change, category')
      .order('created_at', { ascending: false });

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
    if (price === null || price === undefined) return '0M';
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(2)}M`;
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(2)}K`;
    }
    return price.toFixed(2);
  };

  const formatVolume = (volume: string | null) => {
    if (!volume) return '0';
    return volume;
  };

  const formatChange = (change: number | null) => {
    if (change === null || change === undefined) return '0.00';
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  };

  const currentDate = new Date().toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pb-20 md:pb-8">
        {/* Header */}
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 sticky top-16 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gradient mb-2">Sản phẩm</h1>
            
            {/* Stock ticker info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span className="text-primary">•</span>
              <span>Singapore Technologies Engineering Ltd (SGX: S63)</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span>Ngày: {currentDate}</span>
              <span className="flex items-center gap-1">
                <Activity className="w-4 h-4 text-primary" />
                Số lượng giao dịch: {totalVolume.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="container mx-auto px-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Không có sản phẩm nào.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {products.map((product) => {
                const isPositive = (product.price_change || 0) >= 0;
                
                return (
                  <Card 
                    key={product.id} 
                    className="group bg-card border-border hover:border-primary/30 transition-all duration-300 overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    {/* Product Image - Full Width with Hover Zoom */}
                    {product.image_url ? (
                      <div className="w-full h-32 md:h-40 overflow-hidden">
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-32 md:h-40 bg-muted/30 flex items-center justify-center">
                        {getCategoryIcon(product.name, product.category)}
                      </div>
                    )}
                    
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm md:text-base line-clamp-1 mb-1">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>24HVOL:</span>
                            <span className="text-foreground">{formatVolume(product.volume)}</span>
                          </div>
                        </div>
                        
                        {/* Price & Change */}
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-lg font-bold text-foreground">
                            {formatPrice(product.price)}
                          </span>
                          <div className={cn(
                            'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                            isPositive 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          )}>
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span>{formatChange(product.price_change)}%</span>
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
