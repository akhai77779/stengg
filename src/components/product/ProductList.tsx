import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ProductCard } from './ProductCard';
import type { ProductWithChart } from '@/hooks/useProductsData';
import { useSharedProductRealtime } from '@/hooks/useSharedProductRealtime';

interface ProductListProps {
  products: ProductWithChart[];
  isLoading: boolean;
}

interface LiveProductCardProps {
  product: ProductWithChart;
  formatPrice: (price: number | null) => string;
  formatVolume: (volume: string | null, turnover: string | null) => string;
  formatChange: (change: number | null) => string;
}

function LiveProductCard({ product, formatPrice, formatVolume, formatChange }: LiveProductCardProps) {
  const realtime = useSharedProductRealtime({
    productId: product.id,
    timeframe: '1m',
    enabled: !!product.id,
    throttleMs: 150,
  });

  const liveProduct = useMemo<ProductWithChart>(() => {
    const liveCandles = realtime.candles.map(candle => ({
      product_id: product.id,
      recorded_at: candle.time,
      open_price: Number(candle.open),
      high_price: Number(candle.high),
      low_price: Number(candle.low),
      close_price: Number(candle.close),
    }));

    return {
      ...product,
      price: realtime.latestPrice ?? product.price,
      high_24h: realtime.highPrice ?? product.high_24h,
      low_24h: realtime.lowPrice ?? product.low_24h,
      price_change: realtime.product?.price_change ?? product.price_change,
      volume: realtime.product?.volume ?? product.volume,
      turnover: realtime.product?.turnover ?? product.turnover,
      candles: liveCandles.length >= 2 ? liveCandles : product.candles,
    };
  }, [product, realtime.candles, realtime.highPrice, realtime.latestPrice, realtime.lowPrice, realtime.product]);

  return (
    <ProductCard
      product={liveProduct}
      formatPrice={formatPrice}
      formatVolume={formatVolume}
      formatChange={formatChange}
    />
  );
}

export function ProductList({ products, isLoading }: ProductListProps) {
  const { t } = useLanguage();
  const { formatCurrency } = useCurrency();

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('products.noProducts')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:gap-5 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {products.map(product => (
        <LiveProductCard
          key={product.id}
          product={product}
          formatPrice={formatPrice}
          formatVolume={formatVolume}
          formatChange={formatChange}
        />
      ))}
    </div>
  );
}
