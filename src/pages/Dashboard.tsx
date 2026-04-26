import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Newspaper, 
  Package, 
  Heart, 
  TrendingUp,
  Loader2,
  BarChart3,
  Bell
} from 'lucide-react';
import { DashboardNews } from '@/components/dashboard/DashboardNews';
import { DashboardProducts } from '@/components/dashboard/DashboardProducts';
import { DashboardCharity } from '@/components/dashboard/DashboardCharity';
import { DashboardUsers } from '@/components/dashboard/DashboardUsers';
import { DashboardBanners } from '@/components/dashboard/DashboardBanners';
import { DashboardTransactions } from '@/components/dashboard/DashboardTransactions';
import { DashboardAuditLogs } from '@/components/dashboard/DashboardAuditLogs';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { Marquee } from '@/components/dashboard/Marquee';
import { AnimatedBorderCard } from '@/components/dashboard/AnimatedBorderCard';
import { UserOptionTradeHistory } from '@/components/dashboard/UserOptionTradeHistory';

interface Stats {
  totalUsers: number;
  totalNews: number;
  totalProducts: number;
  totalCharity: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalNews: 0,
    totalProducts: 0,
    totalCharity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { pendingCount } = useAdminNotifications();
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
        supabase.from('news').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('charity_programs').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalNews: newsResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalCharity: charityResult.count || 0,
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
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Marquee Notification */}
        <div className="mb-6">
          <Marquee message="Chào mừng bạn đến với hệ thống quản trị ST Engineering. Dịch vụ khách hàng trực tuyến 09:00-22:00. Liên hệ hỗ trợ nếu cần giúp đỡ!" />
        </div>

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

        {/* Stats Cards with Animated Border */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, index) => (
            <AnimatedBorderCard key={stat.label}>
              <Card className="bg-card border-0">
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
            </AnimatedBorderCard>
          ))}
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
            <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-1" />
              Thống kê
            </TabsTrigger>
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
            <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground relative">
              <Bell className="w-4 h-4 mr-1" />
              Giao dịch
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-xs animate-pulse">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="option-history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <TrendingUp className="w-4 h-4 mr-1" />
              Quyền chọn
            </TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Người dùng
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats">
            <DashboardStats />
          </TabsContent>

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

          <TabsContent value="transactions">
            <DashboardTransactions />
          </TabsContent>

          <TabsContent value="option-history">
            <UserOptionTradeHistory />
          </TabsContent>

          <TabsContent value="audit">
            <DashboardAuditLogs />
          </TabsContent>

          <TabsContent value="users">
            <DashboardUsers />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
