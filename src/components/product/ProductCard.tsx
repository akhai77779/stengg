import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Plane, Cpu, Car, Ship, Shield, Building2, GraduationCap, Briefcase, Satellite, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MiniCandleChart } from '@/components/product/MiniCandleChart';
import { AnimatedPrice, AnimatedStat } from '@/components/product/AnimatedPrice';
import type { ProductWithChart } from '@/hooks/useProductsData';

const getCategoryIcon = (name: string, category: string | null) => {
  const iconClass = "w-10 h-10 p-2 rounded-lg";
  const map: [RegExp, React.ReactNode][] = [
    [/Aerospace/i, <Plane className={cn(iconClass, "bg-blue-500/20 text-blue-400")} />],
    [/Electronics/i, <Cpu className={cn(iconClass, "bg-purple-500/20 text-purple-400")} />],
    [/Land/i, <Car className={cn(iconClass, "bg-amber-500/20 text-amber-400")} />],
    [/Marine/i, <Ship className={cn(iconClass, "bg-cyan-500/20 text-cyan-400")} />],
    [/Defence/i, <Shield className={cn(iconClass, "bg-red-500/20 text-red-400")} />],
    [/Smart City/i, <Building2 className={cn(iconClass, "bg-emerald-500/20 text-emerald-400")} />],
    [/Training/i, <GraduationCap className={cn(iconClass, "bg-orange-500/20 text-orange-400")} />],
    [/Commercial/i, <Briefcase className={cn(iconClass, "bg-indigo-500/20 text-indigo-400")} />],
    [/iDirect/i, <Satellite className={cn(iconClass, "bg-pink-500/20 text-pink-400")} />],
    [/Research/i, <FlaskConical className={cn(iconClass, "bg-teal-500/20 text-teal-400")} />],
  ];
  const combined = `${name} ${category || ''}`;
  for (const [regex, icon] of map) {
    if (regex.test(combined)) return icon;
  }
  return <Activity className={cn(iconClass, "bg-primary/20 text-primary")} />;
};

interface ProductCardProps {
  product: ProductWithChart;
  formatPrice: (price: number | null) => string;
  formatVolume: (volume: string | null, turnover: string | null) => string;
  formatChange: (change: number | null) => string;
}

export function ProductCard({ product, formatPrice, formatVolume, formatChange }: ProductCardProps) {
  const navigate = useNavigate();
  const isPositive = (product.price_change || 0) >= 0;
  const chartData = product.candles.map(c => ({
    open: c.open_price,
    high: c.high_price,
    low: c.low_price,
    close: c.close_price,
  }));

  const changeBadgeClass = cn(
    'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium',
    isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
  );

  return (
    <Card
      className="group bg-card border-border hover:border-primary/30 transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.99]"
      onClick={() => navigate(`/products/${product.id}`)}
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          {/* Thumbnail */}
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

          {/* Info */}
          <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
            <h3 className="font-semibold text-foreground text-sm md:text-base line-clamp-1 mb-1">
              {product.name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>24HVOL:</span>
              <span className="text-foreground">{formatVolume(product.volume, product.turnover)}</span>
            </div>
            {/* Mobile price */}
            <div className="flex items-center gap-2 mt-1 md:hidden">
              <AnimatedPrice value={product.price} formatter={formatPrice} className="text-base font-bold tabular-nums" />
              <div className={changeBadgeClass}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <AnimatedStat value={formatChange(product.price_change)} className="text-xs font-medium" />
                <span>%</span>
              </div>
            </div>
          </div>

          {/* Chart + Desktop price */}
          <div className="flex items-center gap-3 pr-3 py-2">
            <div className="flex-shrink-0">
              {chartData.length >= 2 ? (
                <MiniCandleChart data={chartData} width={100} height={52} className="opacity-90 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-[100px] h-[52px] flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/50">—</span>
                </div>
              )}
            </div>
            <div className="hidden md:flex flex-col items-end gap-1 min-w-[90px]">
              <AnimatedPrice value={product.price} formatter={formatPrice} className="text-base md:text-lg font-bold tabular-nums" />
              <div className={cn(changeBadgeClass, 'gap-1 px-2')}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <AnimatedStat value={formatChange(product.price_change)} className="text-xs font-medium" />
                <span>%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
