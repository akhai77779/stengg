import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Newspaper, 
  Package, 
  Heart, 
  Eye, 
  TrendingUp,
  Loader2,
  BarChart3
} from 'lucide-react';
import { DashboardNews } from '@/components/dashboard/DashboardNews';
import { DashboardProducts } from '@/components/dashboard/DashboardProducts';
import { DashboardCharity } from '@/components/dashboard/DashboardCharity';
import { DashboardUsers } from '@/components/dashboard/DashboardUsers';
import { DashboardBanners } from '@/components/dashboard/DashboardBanners';

interface Stats {
  totalUsers: number;
  totalNews: number;
  totalProducts: number;
  totalCharity: number;
  totalViews: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalNews: 0,
    totalProducts: 0,
    totalCharity: 0,
    totalViews: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/auth');
      } else if (!isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchStats();
    }
  }, [user, isAdmin]);

  const fetchStats = async () => {
    try {
      const [usersResult, newsResult, productsResult, charityResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('news').select('id, views', { count: 'exact' }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('charity_programs').select('id', { count: 'exact', head: true }),
      ]);

      const totalViews = newsResult.data?.reduce((sum, n) => sum + (n.views || 0), 0) || 0;

      setStats({
        totalUsers: usersResult.count || 0,
        totalNews: newsResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalCharity: charityResult.count || 0,
        totalViews,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
    setIsLoading(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const statCards = [
    { label: 'Người dùng', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
    { label: 'Tin tức', value: stats.totalNews, icon: Newspaper, color: 'text-green-400' },
    { label: 'Sản phẩm', value: stats.totalProducts, icon: Package, color: 'text-purple-400' },
    { label: 'Từ thiện', value: stats.totalCharity, icon: Heart, color: 'text-pink-400' },
    { label: 'Lượt xem', value: stats.totalViews, icon: Eye, color: 'text-yellow-400' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              <span className="text-gradient">Dashboard Admin</span>
            </h1>
            <p className="text-muted-foreground">Quản lý nội dung và người dùng</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="news" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="banners" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Hero Banners
            </TabsTrigger>
            <TabsTrigger value="news" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Tin tức
            </TabsTrigger>
            <TabsTrigger value="products" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Sản phẩm
            </TabsTrigger>
            <TabsTrigger value="charity" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Từ thiện
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Người dùng
            </TabsTrigger>
          </TabsList>

          <TabsContent value="banners">
            <DashboardBanners />
          </TabsContent>

          <TabsContent value="news">
            <DashboardNews />
          </TabsContent>

          <TabsContent value="products">
            <DashboardProducts />
          </TabsContent>

          <TabsContent value="charity">
            <DashboardCharity />
          </TabsContent>

          <TabsContent value="users">
            <DashboardUsers />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
