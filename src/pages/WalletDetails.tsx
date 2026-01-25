import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useExternalBalance } from '@/hooks/useExternalBalance';
import { 
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Skeleton component for balance card
function BalanceCardSkeleton() {
  return (
    <Card className="bg-card border-border mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="w-20 h-20 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton component for income cards
function IncomeCardSkeleton() {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-16" />
      </CardContent>
    </Card>
  );
}

interface Profile {
  id: string;
  full_name: string | null;
  balance: number | null;
  total_income: number | null;
}

interface DailyIncome {
  date: string;
  amount: number;
}

export default function WalletDetails() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [todayTradeIncome, setTodayTradeIncome] = useState(0);
  const [charityIncome, setCharityIncome] = useState(0);
  const [dailyIncomeHistory, setDailyIncomeHistory] = useState<DailyIncome[]>([]);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency, currency } = useCurrency();
  const navigate = useNavigate();
  
  const { 
    balance: externalBalance, 
    frozen: frozenBalance,
    isLoading: externalLoading
  } = useExternalBalance(user?.id);

  const balance = externalBalance ?? profile?.balance ?? 0;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTodayIncome();
      fetchDailyIncomeHistory();
      
      const channel = supabase
        .channel('wallet-balance')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'option_trades',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchTodayIncome();
            fetchDailyIncomeHistory();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    // Use profiles_safe view to exclude sensitive fields (withdrawal_password_hash, last_login_ip)
    const { data, error } = await supabase
      .from('profiles_safe')
      .select('id, full_name, balance, total_income')
      .eq('id', user!.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data as Profile);
    }
    setIsLoading(false);
  };

  const fetchTodayIncome = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Fetch today's option trade profits
    const { data: trades, error } = await supabase
      .from('option_trades')
      .select('profit_loss')
      .eq('user_id', user!.id)
      .in('status', ['won', 'lost'])
      .gte('settled_at', today.toISOString());

    if (!error && trades) {
      const totalProfit = trades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0);
      setTodayTradeIncome(totalProfit);
    }
  };

  const fetchDailyIncomeHistory = async () => {
    // Get last 30 days of income grouped by day
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: trades, error } = await supabase
      .from('option_trades')
      .select('profit_loss, settled_at')
      .eq('user_id', user!.id)
      .in('status', ['won', 'lost'])
      .gte('settled_at', thirtyDaysAgo.toISOString())
      .order('settled_at', { ascending: false });

    if (!error && trades) {
      // Group by date
      const groupedByDate: Record<string, number> = {};
      trades.forEach(trade => {
        if (trade.settled_at) {
          const date = new Date(trade.settled_at).toLocaleDateString('vi-VN');
          groupedByDate[date] = (groupedByDate[date] || 0) + (trade.profit_loss || 0);
        }
      });

      const history = Object.entries(groupedByDate).map(([date, amount]) => ({
        date,
        amount
      }));
      setDailyIncomeHistory(history);
    }
  };

  const formatAmount = (amount: number) => {
    if (!showBalance) return '****';
    return formatCurrency(amount);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show skeleton while loading data
  const showSkeleton = isLoading || externalLoading;

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground flex-1 text-center pr-10">
              {t('wallet.assets')}
            </h1>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full mb-4 bg-transparent border-b border-border rounded-none p-0 h-auto">
              <TabsTrigger 
                value="overview" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3"
              >
                {t('wallet.overview')}
              </TabsTrigger>
              <TabsTrigger 
                value="charity" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-3"
              >
                {t('wallet.charityTalent')}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-0">
              {/* Balance Card */}
              {showSkeleton ? (
                <BalanceCardSkeleton />
              ) : (
                <Card className="bg-card border-border mb-6">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">
                        {t('wallet.valuation')} ({currency})
                      </span>
                      <button 
                        onClick={() => setShowBalance(!showBalance)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {formatAmount(balance)}
                        </p>
                      </div>
                      <div className="w-20 h-20 flex items-center justify-center bg-muted/30 rounded-lg">
                        <Wallet className="w-10 h-10 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Today's Income */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {t('wallet.todayIncome')}
                </h3>
                
                {showSkeleton ? (
                  <div className="space-y-3">
                    <IncomeCardSkeleton />
                    <IncomeCardSkeleton />
                  </div>
                ) : (
                  <>
                    <Card className="bg-card border-border mb-3">
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t('wallet.productTrade')} ({currency})
                        </span>
                        <span className={cn(
                          "font-mono font-medium",
                          todayTradeIncome > 0 ? "text-green-500" : todayTradeIncome < 0 ? "text-red-500" : "text-foreground"
                        )}>
                          {showBalance ? todayTradeIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '****'}
                        </span>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t('wallet.charityTalent')} ({currency})
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {showBalance ? charityIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '****'}
                        </span>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>

              {/* Account Details */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {t('wallet.accountDetails')}
                </h3>
                
                {showSkeleton ? (
                  <div className="space-y-3">
                    <IncomeCardSkeleton />
                    <IncomeCardSkeleton />
                  </div>
                ) : (
                  <>
                    <Card className="bg-card border-border mb-3">
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t('wallet.availableBalance')} ({currency})
                        </span>
                        <span className="font-mono font-medium text-primary">
                          {formatAmount(balance)}
                        </span>
                      </CardContent>
                    </Card>

                    <Card className="bg-card border-border">
                      <CardContent className="p-4 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {t('wallet.charityTalent')} ({currency})
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {showBalance ? '0' : '****'}
                        </span>
                      </CardContent>
                    </Card>

                    {frozenBalance !== null && frozenBalance > 0 && (
                      <Card className="bg-card border-border mt-3">
                        <CardContent className="p-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {t('wallet.frozenBalance')} ({currency})
                          </span>
                          <span className="font-mono font-medium text-orange-500">
                            {formatAmount(frozenBalance)}
                          </span>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Charity Tab */}
            <TabsContent value="charity" className="mt-0">
              {/* Charity Balance Card */}
              <Card className="bg-card border-border mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">
                      {t('wallet.valuation')} ({currency})
                    </span>
                    <button 
                      onClick={() => setShowBalance(!showBalance)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-bold text-foreground">
                      {showBalance ? '0' : '****'}
                    </p>
                    <div className="w-20 h-20 flex items-center justify-center bg-muted/30 rounded-lg">
                      <Wallet className="w-10 h-10 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* No Profit Card */}
              <Card className="bg-card border-border mb-6">
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('wallet.noProfit')}
                  </span>
                  <span className="font-mono font-medium text-foreground">0</span>
                </CardContent>
              </Card>

              {/* Daily Income History */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {t('wallet.dailyIncomeHistory')}
                </h3>
                
                {dailyIncomeHistory.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      {t('wallet.noHistory')}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {dailyIncomeHistory.map((item, index) => (
                      <Card key={index} className="bg-card border-border">
                        <CardContent className="p-4 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{item.date}</span>
                          <span className={cn(
                            "font-mono font-medium",
                            item.amount > 0 ? "text-green-500" : item.amount < 0 ? "text-red-500" : "text-foreground"
                          )}>
                            {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </Layout>
  );
}
