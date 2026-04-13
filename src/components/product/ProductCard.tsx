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
      className="group relative bg-card/80 backdrop-blur-md border-border/50 hover:border-primary/40 transition-all duration-300 cursor-pointer active:scale-[0.99] overflow-visible"
      onClick={() => navigate(`/products/${product.id}`)}
    >
      <CardContent className="p-0">
        {/* Mobile: horizontal row layout */}
        <div className="flex items-stretch md:hidden overflow-hidden rounded-lg">
          <div className="w-16 flex-shrink-0 relative">
            {product.image_url ? (
              <div className="h-full overflow-hidden">
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover min-h-[72px]" loading="lazy" />
              </div>
            ) : (
              <div className="h-full min-h-[72px] bg-muted/30 flex items-center justify-center">
                {getCategoryIcon(product.name, product.category)}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center">
            <h3 className="font-semibold text-foreground text-sm line-clamp-1 mb-1">{product.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>VOL:</span>
              <span className="text-foreground">{formatVolume(product.volume, product.turnover)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <AnimatedPrice value={product.price} formatter={formatPrice} className="text-base font-bold tabular-nums" />
              <div className={changeBadgeClass}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <AnimatedStat value={formatChange(product.price_change)} className="text-xs font-medium" />
                <span>%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center pr-3 py-2">
            {chartData.length >= 2 ? (
              <MiniCandleChart data={chartData} width={100} height={52} className="opacity-90 group-hover:opacity-100 transition-opacity" />
            ) : (
              <div className="w-[100px] h-[52px] flex items-center justify-center">
                <span className="text-xs text-muted-foreground/50">—</span>
              </div>
            )}
          </div>
        </div>

        {/* Desktop: card with image breaking out of frame */}
        <div className="hidden md:block relative pl-20 pr-4 py-4">
          {/* Floating image - positioned outside the card on the left */}
          <div className="absolute -left-5 top-1/2 -translate-y-1/2 z-10">
            {product.image_url ? (
              <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden ring-4 ring-background shadow-2xl shadow-black/30 group-hover:scale-110 group-hover:-translate-x-1 transition-all duration-300">
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="w-[72px] h-[72px] rounded-2xl bg-card ring-4 ring-background shadow-2xl shadow-black/30 flex items-center justify-center group-hover:scale-110 group-hover:-translate-x-1 transition-all duration-300">
                {getCategoryIcon(product.name, product.category)}
              </div>
            )}
          </div>

          {/* Content area */}
          <div className="flex flex-col gap-2">
            {/* Top: name + badge */}
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground text-sm line-clamp-1">{product.name}</h3>
                <span className="text-xs text-muted-foreground">{product.symbol || product.category}</span>
              </div>
              <div className={cn(changeBadgeClass, 'gap-1 px-2 flex-shrink-0')}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <AnimatedStat value={formatChange(product.price_change)} className="text-xs font-medium" />
                <span>%</span>
              </div>
            </div>

            {/* Chart */}
            <div>
              {chartData.length >= 2 ? (
                <MiniCandleChart data={chartData} width={260} height={80} className="w-full opacity-90 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-[80px] flex items-center justify-center">
                  <span className="text-xs text-muted-foreground/50">No data</span>
                </div>
              )}
            </div>

            {/* Price + H/L */}
            <div className="flex items-end justify-between">
              <div>
                <AnimatedPrice value={product.price} formatter={formatPrice} className="text-lg font-bold tabular-nums" />
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span>VOL</span>
                  <span className="text-foreground/70">{formatVolume(product.volume, product.turnover)}</span>
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground space-y-0.5">
                <div className="flex items-center gap-1 justify-end">
                  <span>H</span>
                  <span className="text-green-400 font-mono tabular-nums">{formatPrice(product.high_24h ?? null)}</span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <span>L</span>
                  <span className="text-red-400 font-mono tabular-nums">{formatPrice(product.low_24h ?? null)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
