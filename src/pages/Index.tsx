import { Layout } from '@/components/layout/Layout';
import { HeroSlider } from '@/components/home/HeroSlider';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSync } from '@/hooks/useAutoSync';
import { Loader2 } from 'lucide-react';
import GuestHome from './GuestHome';

const Index = () => {
  const { user, isLoading } = useAuth();

  // Auto-sync disabled
  useAutoSync({ 
    enabled: false,
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
    </Layout>
  );
};

export default Index;
