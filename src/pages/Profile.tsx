import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { LanguageSelect } from '@/components/settings/LanguageSelect';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { useExternalBalance } from '@/hooks/useExternalBalance';
import { 
  Wallet, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  CreditCard, 
  Headphones,
  ShieldCheck,
  BadgeCheck,
  Settings,
  Globe,
  UserPlus,
  RefreshCw,
  LogOut,
  Loader2,
  Copy,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  balance: number | null;
  total_income: number | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, signOut, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { formatCurrency, currency } = useCurrency();
  const navigate = useNavigate();
  
  // Fetch external balance from API
  const { 
    balance: externalBalance, 
    frozen: frozenBalance,
    isLoading: externalLoading, 
    refetch: refetchExternalBalance 
  } = useExternalBalance(user?.id);

  // Use external balance if available, otherwise fall back to local profile balance
  const balance = externalBalance ?? profile?.balance ?? 0;
  const uid = user?.id?.slice(0, 5) || '00000';

  const languageNames: Record<string, string> = {
    vi: 'Tiếng Việt',
    en: 'English',
    zh: '中文',
    th: 'ไทย',
    ja: '日本語',
    ko: '한국어',
    id: 'Bahasa Indonesia',
    ms: 'Bahasa Melayu',
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      
      // Subscribe to realtime balance updates
      const channel = supabase
        .channel('profile-balance')
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
      .select('*')
      .eq('id', user!.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data);
    }
    setIsLoading(false);
  };

  const copyUID = () => {
    navigator.clipboard.writeText(uid);
    toast({
      title: t('common.copied'),
      description: t('profile.uidCopied'),
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
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
    { icon: CreditCard, label: t('profile.transactionHistory'), color: 'text-blue-400', href: '/wallet-details' },
    { icon: Headphones, label: t('profile.customerService'), color: 'text-purple-400', href: '#' },
  ];

  const accountSettings = [
    { icon: Wallet, label: t('profile.walletDetails'), href: '/wallet-details', badge: null },
    { icon: ShieldCheck, label: t('profile.security'), href: '#', badge: t('transaction.approved'), badgeColor: 'text-green-400' },
    { icon: BadgeCheck, label: t('profile.verification'), href: '#', badge: t('transaction.approved'), badgeColor: 'text-green-400' },
  ];

  const systemSettings = [
    { icon: Settings, label: t('common.settings'), href: '#', value: null, isLink: true },
    { icon: UserPlus, label: t('profile.invite'), href: '#', value: null, isLink: true },
    { icon: RefreshCw, label: t('profile.sync'), href: '#', value: null, isLink: true },
  ];

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          
          {/* User Card */}
          <Card className="bg-card border-border mb-6 overflow-hidden">
            <div className="relative h-20 bg-gradient-to-r from-primary/20 to-secondary/20" />
            <CardContent className="relative pt-0 pb-6 px-4">
              <div className="flex items-end gap-4 -mt-10">
                <Avatar className="w-20 h-20 border-4 border-card shadow-lg">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                    {getInitials(profile?.full_name || null, user.email || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 pb-2">
                  <h2 className="text-lg font-bold text-foreground">
                    {profile?.full_name || user.email?.split('@')[0] || t('profile.defaultUser')}
                  </h2>
                  <button 
                    onClick={copyUID}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <span>UID: {uid}</span>
                    <Copy className="w-3 h-3" />
                    <span className="text-primary">{t('common.copy')}</span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Card */}
          <Card className="bg-card border-border mb-6">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-1">{t('profile.balance')} ({currency})</p>
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
              <div className="grid grid-cols-4 gap-2">
                {quickActions.map((action) => (
                  <Link 
                    key={action.label} 
                    to={action.href}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn('p-2 rounded-full bg-card', action.color)}>
                      <action.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center">{action.label}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>


          {/* Account Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{t('profile.account')}</h3>
            <Card className="bg-card border-border">
              <CardContent className="p-0 divide-y divide-border">
                {accountSettings.map((item) => (
                  <Link 
                    key={item.label} 
                    to={item.href}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <span className={cn('text-xs', item.badgeColor)}>{item.badge}</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* System Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 px-1">{t('profile.system')}</h3>
            <Card className="bg-card border-border">
              <CardContent className="p-0 divide-y divide-border">
              {/* Language Selector */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-foreground">{t('settings.language')}</span>
                  </div>
                  <LanguageSelect />
                </div>
                
                {systemSettings.map((item) => (
                  <Link 
                    key={item.label} 
                    to={item.href}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && (
                        <span className="text-xs text-muted-foreground">{item.value}</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                
                {/* Sign Out */}
                <button 
                  onClick={handleSignOut}
                  className="flex items-center gap-3 p-4 w-full hover:bg-muted/30 transition-colors text-destructive"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">{t('nav.logout')}</span>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Security Notice */}
          <p className="text-xs text-center text-muted-foreground px-4">
            {t('profile.securityNotice')}
          </p>
        </div>
      </div>
    </Layout>
  );
}