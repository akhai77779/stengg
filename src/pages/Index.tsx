import { Layout } from '@/components/layout/Layout';
import { HeroSlider } from '@/components/home/HeroSlider';
import { LatestNews } from '@/components/home/LatestNews';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSync } from '@/hooks/useAutoSync';
import { Loader2 } from 'lucide-react';
import GuestHome from './GuestHome';

const Index = () => {
  const { user, isLoading } = useAuth();

  // Auto-sync external data every 3 seconds when user is authenticated
  useAutoSync({ 
    enabled: !!user,
    interval: 3000 
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Show GuestHome for unauthenticated users
  if (!user) {
    return <GuestHome />;
  }

  return (
    <Layout>
      <HeroSlider />
      <LatestNews />
      <FeaturedProducts />
    </Layout>
  );
};

export default Index;
