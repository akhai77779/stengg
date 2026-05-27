import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedPrice, AnimatedStat } from '@/components/product/AnimatedPrice';
import type { ProductWithChart } from '@/hooks/useProductsData';

interface ProductCardProps {
  product: ProductWithChart;
  formatPrice: (price: number | null) => string;
  formatVolume: (volume: string | null, turnover: string | null) => string;
  formatChange: (change: number | null) => string;
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=500&fit=crop';

export function ProductCard({ product, formatPrice, formatVolume, formatChange }: ProductCardProps) {
  const navigate = useNavigate();
  const isPositive = (product.price_change || 0) >= 0;

  const changeBadgeClass = cn(
    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
    isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
  );

  return (
    <Card
      className="group relative bg-card/80 backdrop-blur-md border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
      onClick={() => navigate(`/products/${product.id}`)}
    >
      {/* Image */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={product.image_url || FALLBACK_IMG}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 right-2">
          <div className={changeBadgeClass}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <AnimatedStat value={formatChange(product.price_change)} className="text-xs font-medium" />
            <span>%</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-foreground text-base line-clamp-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.symbol && (
            <span className="text-xs text-muted-foreground flex-shrink-0">{product.symbol}</span>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        )}

        <div className="mt-auto pt-2 flex items-end justify-between border-t border-border/40">
          <div>
            <AnimatedPrice
              value={product.price}
              formatter={formatPrice}
              className="text-lg font-bold tabular-nums"
            />
            <div className="text-[11px] text-muted-foreground mt-0.5">
              VOL <span className="text-foreground/70">{formatVolume(product.volume, product.turnover)}</span>
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
    </Card>
  );
}
