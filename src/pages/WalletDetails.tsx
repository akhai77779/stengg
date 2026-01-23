import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { TransactionHistory } from '@/components/profile/TransactionHistory';
import { useExternalBalance } from '@/hooks/useExternalBalance';
import { 
  ArrowLeft,
  ArrowDownToLine, 
  ArrowUpFromLine, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  full_name: string | null;
  balance: number | null;
}

export default function WalletDetails() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();
  const { formatCurrency, currency } = useCurrency();
  const navigate = useNavigate();
  
  const { 
    balance: externalBalance, 
    frozen: frozenBalance,
    isLoading: externalLoading, 
    refetch: refetchExternalBalance 
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
      
      const channel = supabase
        .channel('wallet-balance')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          () => {
            fetchProfile();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, balance')
      .eq('id', user!.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data);
    }
    setIsLoading(false);
  };

  if (authLoading || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const quickActions = [
    { icon: ArrowDownToLine, label: t('transaction.deposit'), color: 'text-green-400', href: '/deposit' },
    { icon: ArrowUpFromLine, label: t('transaction.withdraw'), color: 'text-orange-400', href: '/withdraw' },
  ];

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
            <h1 className="text-xl font-bold text-foreground">{t('profile.walletDetails')}</h1>
          </div>

          {/* Balance Card */}
          <Card className="bg-card border-border mb-6">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <p className="text-sm text-muted-foreground">{t('profile.balance')} ({currency})</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => refetchExternalBalance()}
                    disabled={externalLoading}
                  >
                    <RefreshCw className={cn("w-4 h-4", externalLoading && "animate-spin")} />
                  </Button>
                </div>
                {externalLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-gradient">{formatCurrency(balance)}</p>
                    {frozenBalance !== null && frozenBalance > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Frozen: {formatCurrency(frozenBalance)}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <Button 
                    key={action.label} 
                    variant="outline"
                    className="flex items-center justify-center gap-2 py-6"
                    onClick={() => navigate(action.href)}
                  >
                    <action.icon className={cn("w-5 h-5", action.color)} />
                    <span className="text-sm">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">
              {t('profile.transactionHistory')}
            </h2>
            <TransactionHistory />
          </div>

        </div>
      </div>
    </Layout>
  );
}
