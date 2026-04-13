import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ProductCard } from './ProductCard';
import type { ProductWithChart } from '@/hooks/useProductsData';

interface ProductListProps {
  products: ProductWithChart[];
  isLoading: boolean;
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
    <div className="grid gap-3 md:gap-6 md:pt-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
      {products.map(product => (
        <ProductCard
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
