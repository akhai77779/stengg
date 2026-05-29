import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProductsData } from '@/hooks/useProductsData';
import { ProductList } from '@/components/product/ProductList';
import { Loader2 } from 'lucide-react';

export default function Products() {
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { products, isLoading } = useProductsData(user?.id);

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
    <Layout hideFooter>
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
