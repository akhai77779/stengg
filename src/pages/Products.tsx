import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProductsData } from '@/hooks/useProductsData';
import { useMarketEngine } from '@/contexts/MarketEngineContext';
import { ProductList } from '@/components/product/ProductList';
import { Loader2 } from 'lucide-react';
import type { ProductWithChart } from '@/hooks/useProductsData';

export default function Products() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { products: dbProducts, isLoading } = useProductsData(user?.id);

  // Market Engine for live prices and chart data
  const {
    products: engineProducts,
    isReady: engineReady,
    getCandles,
    getCurrentPrice,
  } = useMarketEngine();

  // Merge DB products with engine data (price + candles) by symbol match
  const products: ProductWithChart[] = useMemo(() => {
    if (!engineReady || engineProducts.length === 0) return dbProducts;

    const engineMap = new Map(engineProducts.map(ep => [ep.symbol, ep]));

    return dbProducts.map(dbp => {
      const engineProduct = dbp.symbol ? engineMap.get(dbp.symbol) : undefined;
      if (!engineProduct) return dbp;

      const enginePrice = getCurrentPrice(engineProduct.id);
      const candles = getCandles(engineProduct.id);

      // Convert engine candles to DB candle format for MiniCandleChart
      const last30 = candles.slice(-30);
      const mappedCandles = last30.map(c => ({
        open_price: c.open,
        high_price: c.high,
        low_price: c.low,
        close_price: c.close,
        product_id: dbp.id,
      }));

      // Compute price change from candles
      const firstCandle = last30[0];
      const lastCandle = last30[last30.length - 1];
      const priceChange = firstCandle && lastCandle
        ? ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100
        : dbp.price_change;

      return {
        ...dbp,
        price: enginePrice || dbp.price,
        price_change: priceChange ?? dbp.price_change,
        candles: mappedCandles.length > 0 ? mappedCandles : dbp.candles,
      };
    });
  }, [dbProducts, engineReady, engineProducts, getCandles, getCurrentPrice]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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
        <div className="bg-card/50 backdrop-blur-sm border-b border-border/50 sticky top-0 md:top-16 z-10">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-lg md:text-xl font-bold text-gradient mb-2 text-center">{t('products.title')}</h1>
            <div className="gap-2 text-xs text-muted-foreground mb-2 flex items-center justify-center">
              <span>Singapore Technologies Engineering</span>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-3 md:px-4 py-4">
          <ProductList products={products} isLoading={isLoading} />
        </div>
      </div>
    </Layout>
  );
}
