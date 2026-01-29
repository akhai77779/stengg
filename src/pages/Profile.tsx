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
import { Wallet, ArrowDownToLine, ArrowUpFromLine, CreditCard, Headphones, ShieldCheck, BadgeCheck, Settings, Globe, UserPlus, ArrowLeftRight, LogOut, Loader2, Copy, ChevronRight, UserCheck, Clock, XCircle, Check, Eye, EyeOff } from 'lucide-react';
import { useLiveChat } from '@/contexts/LiveChatContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { TransactionHistory } from '@/components/profile/TransactionHistory';
import { useRipple } from '@/hooks/useRipple';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  balance: number | null;
  total_income: number | null;
  user_code: number | null;
}
interface IdentityVerification {
  status: 'pending' | 'approved' | 'rejected';
}
export default function Profile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [identityVerification, setIdentityVerification] = useState<IdentityVerification | null>(null);
  const [todayProductEarnings, setTodayProductEarnings] = useState<number>(0);
  const [todayCharityEarnings, setTodayCharityEarnings] = useState<number>(0);
  const [totalCharityBalance, setTotalCharityBalance] = useState<number>(0);
  
  // Ripple effects for menu sections
  const accountRipple = useRipple();
  const systemRipple = useRipple();
  const {
    user,
    signOut,
    isLoading: authLoading
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    t,
    language
  } = useLanguage();
  const {
    formatCurrency,
    currency
  } = useCurrency();
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
  const uid = profile?.user_code?.toString() || '00000';

  // Fetch identity verification status
  useEffect(() => {
    const fetchVerification = async () => {
      if (!user?.id) return;
      const {
        data,
        error
      } = await supabase.from('identity_verifications').select('status').eq('user_id', user.id).maybeSingle();
      if (!error && data) {
        setIdentityVerification(data as IdentityVerification);
      }
    };
    fetchVerification();
  }, [user?.id]);
  const getVerificationStatusDisplay = () => {
    if (!identityVerification) return null;
    switch (identityVerification.status) {
      case 'approved':
        return {
          label: t('identity.statusApproved'),
          color: 'text-green-400',
          icon: Check
        };
      case 'rejected':
        return {
          label: t('identity.statusRejected'),
          color: 'text-red-400',
          icon: XCircle
        };
      default:
        return {
          label: t('identity.statusPending'),
          color: 'text-yellow-400',
          icon: Clock
        };
    }
  };
  const verificationStatus = getVerificationStatusDisplay();
  const languageNames: Record<string, string> = {
    vi: 'Tiếng Việt',
    en: 'English',
    zh: '中文',
    th: 'ไทย',
    ja: '日本語',
    ko: '한국어',
    id: 'Bahasa Indonesia',
    ms: 'Bahasa Melayu'
  };
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTodayEarnings();

      // Subscribe to realtime balance updates
      const channel = supabase.channel('profile-balance').on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`
      }, () => {
        fetchProfile();
      }).subscribe();

      // Subscribe to option_trades updates for earnings
      const tradesChannel = supabase.channel('profile-trades').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'option_trades',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchTodayEarnings();
      }).subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(tradesChannel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    // Use profiles_safe view to exclude sensitive fields (withdrawal_password_hash, last_login_ip)
    const {
      data,
      error
    } = await supabase.from('profiles_safe').select('*').eq('id', user!.id).single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
    } else if (data) {
      setProfile(data as Profile);
    }
    setIsLoading(false);
  };

  const fetchTodayEarnings = async () => {
    if (!user?.id) return;

    // Get start of today in UTC
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    try {
      // Fetch today's won option trades with positive profit
      const { data: trades, error: tradesError } = await supabase
        .from('option_trades')
        .select('profit_loss')
        .eq('user_id', user.id)
        .eq('status', 'won')
        .gte('settled_at', todayStart);

      if (tradesError) {
        console.error('Error fetching today trades:', tradesError);
      } else if (trades) {
        // Sum only positive profits for today's earnings
        const totalProfit = trades.reduce((sum, trade) => {
          const profit = trade.profit_loss || 0;
          return sum + (profit > 0 ? profit : 0);
        }, 0);
        setTodayProductEarnings(totalProfit);
      }

      // For charity earnings - sum from transactions table with type 'charity_income'
      const { data: charityData, error: charityError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'charity_income')
        .eq('status', 'approved')
        .gte('created_at', todayStart);

      if (charityError) {
        console.error('Error fetching charity earnings:', charityError);
      } else if (charityData) {
        const totalCharity = charityData.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        setTodayCharityEarnings(totalCharity);
      }

      // For total charity balance - all time charity income
      const { data: allCharityData, error: allCharityError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('type', 'charity_income')
        .eq('status', 'approved');

      if (allCharityError) {
        console.error('Error fetching total charity:', allCharityError);
      } else if (allCharityData) {
        const total = allCharityData.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        setTotalCharityBalance(total);
      }
    } catch (err) {
      console.error('Error in fetchTodayEarnings:', err);
    }
  };
  const copyUID = () => {
    navigator.clipboard.writeText(uid);
    toast({
      title: t('common.copied'),
      description: t('profile.uidCopied')
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
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  const { openChat } = useLiveChat();
  
  const quickActions = [{
    icon: ArrowDownToLine,
    label: t('transaction.deposit'),
    color: 'text-green-400',
    href: '/deposit'
  }, {
    icon: ArrowUpFromLine,
    label: t('transaction.withdraw'),
    color: 'text-orange-400',
    href: '/withdraw'
  }, {
    icon: CreditCard,
    label: t('profile.transactionHistory'),
    color: 'text-blue-400',
    onClick: () => setShowTransactionHistory(!showTransactionHistory)
  }, {
    icon: Headphones,
    label: t('profile.customerService'),
    color: 'text-purple-400',
    onClick: openChat
  }];
  const accountSettings = [{
    icon: Wallet,
    label: t('profile.walletDetails'),
    href: '/wallet-details',
    badge: null,
    isIdentity: false
  }, {
    icon: UserCheck,
    label: t('identity.verifyIdentity'),
    href: '/identity-verification',
    badge: verificationStatus,
    isIdentity: true
  }, {
    icon: ShieldCheck,
    label: t('profile.security'),
    href: '/security',
    badge: null,
    isIdentity: false
  }];
  const handleAccountItemClick = (item: typeof accountSettings[0], e: React.MouseEvent) => {
    if (item.isIdentity && identityVerification?.status === 'approved') {
      e.preventDefault();
      toast({
        title: t('identity.alreadyVerified'),
        description: t('identity.alreadyVerifiedDesc')
      });
    }
  };
  const systemSettings = [{
    icon: Settings,
    label: t('common.settings'),
    href: '/settings',
    value: null,
    isLink: true
  }, {
    icon: UserPlus,
    label: t('profile.invite'),
    href: '#',
    value: null,
    isLink: true
  }, {
    icon: ArrowLeftRight,
    label: t('profile.switchAccount'),
    href: '/switch-account',
    value: null,
    isLink: true
  }];
  return <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8 rounded-xl">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg text-[#0a1942]/95">
          
          {/* User Card */}
          <Card className="bg-card border-border mb-4 md:mb-6 overflow-hidden">
            <div className="relative h-16 md:h-20 bg-gradient-to-r from-primary/20 to-secondary/20" />
            <CardContent className="relative pt-0 pb-4 md:pb-6 px-3 md:px-4">
              <div className="flex items-end gap-3 md:gap-4 -mt-8 md:-mt-10">
                <Avatar className="w-16 h-16 md:w-20 md:h-20 border-4 border-card shadow-lg">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary text-lg md:text-xl font-bold">
                    {getInitials(profile?.full_name || null, user.email || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 pb-2">
                  <h2 className="text-base md:text-lg font-bold text-foreground">
                    {profile?.full_name || user.email?.split('@')[0] || t('profile.defaultUser')}
                  </h2>
                  <button onClick={copyUID} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors min-h-[44px] -my-2">
                    <span>ID: {uid}</span>
                    <Copy className="w-3 h-3" />
                    <span className="text-destructive">{t('common.copy')}</span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance Card */}
          <Card className="bg-card border-border mb-4 md:mb-6">
            <CardContent className="p-3 md:p-4">
              {/* Balance Row */}
              <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
                {/* Available Balance */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setShowBalance(!showBalance)} className="text-muted-foreground hover:text-foreground transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -m-2">
                      {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{t('wallet.availableBalance')} ({currency})</p>
                  </div>
                  {externalLoading ? (
                    <Skeleton className="h-8 w-28" />
                  ) : (
                    <p className="text-xl md:text-2xl font-bold text-primary">
                      {showBalance ? formatCurrency(balance) : '****'}
                    </p>
                  )}
                </div>
                
                {/* Talent Charity */}
                <div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mb-1">{t('wallet.charityTalent')} ({currency})</p>
                  <p className="text-xl md:text-2xl font-bold text-[#00bdd6]">
                    {showBalance ? formatCurrency(totalCharityBalance) : '****'}
                  </p>
                </div>
              </div>

              {/* Today Earnings */}
              <div className="mb-3 md:mb-4">
                <p className="text-[10px] md:text-xs text-muted-foreground mb-2">{t('wallet.todayIncome')}</p>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{t('wallet.productTrade')} ({currency})</p>
                    <p className="text-base md:text-lg font-semibold text-[#26e36b]">
                      {showBalance ? formatCurrency(todayProductEarnings) : '****'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{t('wallet.charityTalent')} ({currency})</p>
                    <p className="text-base md:text-lg font-semibold bg-[#0b111e] text-[#11df6e]">
                      {showBalance ? formatCurrency(todayCharityEarnings) : '****'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Frozen Balance */}
              {frozenBalance !== null && frozenBalance > 0 && <p className="text-xs text-muted-foreground">
                  {t('wallet.frozenBalance')}: {showBalance ? formatCurrency(frozenBalance) : '****'}
                </p>}

              {/* Quick Actions */}
              <div className="grid grid-cols-4 gap-2 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-border">
                {quickActions.map(action => 
                  action.onClick ? (
                    <button 
                      key={action.label} 
                      onClick={action.onClick}
                      className="flex flex-col items-center gap-1.5 md:gap-2 p-2 md:p-3 rounded-lg transition-colors bg-primary-foreground text-center text-white min-h-[72px] active:scale-[0.98] touch-action-manipulation"
                    >
                      <div className={cn('p-1.5 md:p-2 rounded-full bg-card', action.color)}>
                        <action.icon className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <span className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-tight">{action.label}</span>
                    </button>
                  ) : (
                    <Link key={action.label} to={action.href!} className="flex flex-col items-center gap-1.5 md:gap-2 p-2 md:p-3 rounded-lg transition-colors bg-primary-foreground text-center text-white min-h-[72px] active:scale-[0.98] touch-action-manipulation">
                      <div className={cn('p-1.5 md:p-2 rounded-full bg-card', action.color)}>
                        <action.icon className="w-4 h-4 md:w-5 md:h-5" />
                      </div>
                      <span className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-tight">{action.label}</span>
                    </Link>
                  )
                )}
              </div>
              
              {/* Transaction History Inline */}
              {showTransactionHistory && (
                <div className="mt-4 pt-4 border-t border-border">
                  <TransactionHistory />
                </div>
              )}
            </CardContent>
          </Card>


          {/* Account Section */}
          <div className="mb-4 md:mb-6">
            <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-3 px-1">{t('profile.account')}</h3>
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0 divide-y divide-border">
                {accountSettings.map(item => (
                  <Link 
                    key={item.label} 
                    to={item.href} 
                    onClick={(e) => {
                      accountRipple.createRipple(e);
                      handleAccountItemClick(item, e);
                    }} 
                    className="relative flex items-center justify-between p-3 md:p-4 hover:bg-muted/30 transition-all duration-200 min-h-[52px] active:scale-[0.99] touch-action-manipulation overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-muted-foreground transition-transform group-active:scale-95" />
                      <span className="text-sm text-foreground">{item.label}</span>
                      {item.badge && (
                        <span className={cn("text-xs", item.badge.color)}>
                          {item.badge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                    <accountRipple.RippleContainer />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* System Section */}
          <div className="mb-4 md:mb-6">
            <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-3 px-1">{t('profile.system')}</h3>
            <Card className="bg-card border-border overflow-hidden">
              <CardContent className="p-0 divide-y divide-border">
              {/* Language Selector */}
                <div className="flex items-center justify-between p-3 md:p-4 min-h-[52px]">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-foreground">{t('settings.language')}</span>
                  </div>
                  <LanguageSelect />
                </div>
                
                {systemSettings.map(item => (
                  <Link 
                    key={item.label} 
                    to={item.href} 
                    onClick={systemRipple.createRipple}
                    className="relative flex items-center justify-between p-3 md:p-4 hover:bg-muted/30 transition-all duration-200 min-h-[52px] active:scale-[0.99] touch-action-manipulation overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && <span className="text-xs text-muted-foreground">{item.value}</span>}
                      <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                    <systemRipple.RippleContainer />
                  </Link>
                ))}
                
                {/* Sign Out */}
                <button onClick={handleSignOut} className="relative p-3 md:p-4 w-full transition-all duration-200 flex items-center justify-center text-white bg-[#cc0000] gap-[10px] text-base font-sans font-medium border-double rounded-3xl min-h-[52px] active:scale-[0.98] active:bg-[#aa0000] touch-action-manipulation overflow-hidden">
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm">{t('nav.logout')}</span>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Transaction History */}
          <div className="mb-4 md:mb-6">
            <TransactionHistory />
          </div>

          {/* Security Notice */}
          <p className="text-[10px] md:text-xs text-center text-muted-foreground px-4">
            {t('profile.securityNotice')}
          </p>
        </div>
      </div>
    </Layout>;
}