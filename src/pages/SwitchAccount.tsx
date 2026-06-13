import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, Trash2, Plus, Loader2, LogIn } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { z } from 'zod';


interface SavedAccount {
  email: string;
  lastLogin: string;
  // Tokens are ONLY kept for the currently-active account so that an XSS
  // attack cannot harvest sessions for every saved account. Switching to
  // another saved account requires re-login.
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
}

// Strip tokens from any entry that is not the currently-active email.
// Limits XSS blast radius to the active session only.
function sanitizeAccounts(list: SavedAccount[], activeEmail: string | null): SavedAccount[] {
  return list.map(a =>
    a.email === activeEmail
      ? a
      : { email: a.email, lastLogin: a.lastLogin, userId: a.userId },
  );
}

export default function SwitchAccount() {
  const navigate = useNavigate();
  const { user, signOut, signIn } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showDeleteMode, setShowDeleteMode] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);

  const emailSchema = z.string().email(t('auth.email') + ' không hợp lệ');
  const passwordSchema = z.string().min(6, t('auth.password') + ' phải có ít nhất 6 ký tự');

  // Load saved accounts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedAccounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SavedAccount[];
        // Defensive: purge any stale tokens for non-active accounts that may
        // exist from older versions of the app.
        const cleaned = sanitizeAccounts(parsed, user?.email ?? null);
        if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
          localStorage.setItem('savedAccounts', JSON.stringify(cleaned));
        }
        setSavedAccounts(cleaned);
      } catch (e) {
        console.error('Error parsing saved accounts:', e);
      }
    }
  }, [user?.email]);

  // Fetch last login time for current user
  useEffect(() => {
    const fetchLastLogin = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('profiles_safe')
        .select('last_login_at')
        .eq('id', user.id)
        .single();
      
      if (data?.last_login_at) {
        setLastLoginAt(data.last_login_at);
      }
    };
    
    fetchLastLogin();
  }, [user?.id]);

  // Snapshot the current session into savedAccounts on mount so the active
  // account always has tokens stored — required to switch back to it later.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user?.email) return;
      try {
        const raw = localStorage.getItem('savedAccounts');
        const list: SavedAccount[] = raw ? JSON.parse(raw) : [];
        const existing = list.find(a => a.email === session.user!.email);
        // Only update if tokens are missing or have changed
        if (existing?.refreshToken === session.refresh_token) return;
        const filtered = list.filter(a => a.email !== session.user!.email);
        const updated: SavedAccount[] = sanitizeAccounts([
          {
            email: session.user.email,
            lastLogin: new Date().toISOString(),
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            userId: session.user.id,
          },
          ...filtered,
        ], session.user.email);
        localStorage.setItem('savedAccounts', JSON.stringify(updated));
        setSavedAccounts(updated);
      } catch (e) {
        console.error('Failed to snapshot session:', e);
      }
    })();
  }, [user?.id]);

  const formatLastLogin = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const persistAccounts = (list: SavedAccount[]) => {
    // Always strip tokens from inactive accounts before persisting.
    const cleaned = sanitizeAccounts(list, user?.email ?? list[0]?.email ?? null);
    setSavedAccounts(cleaned);
    localStorage.setItem('savedAccounts', JSON.stringify(cleaned));
  };

  const readAccounts = (): SavedAccount[] => {
    try {
      const raw = localStorage.getItem('savedAccounts');
      return raw ? (JSON.parse(raw) as SavedAccount[]) : [];
    } catch {
      return [];
    }
  };

  /**
   * Snapshot the CURRENT Supabase session and store it under its email so we
   * can restore it later via setSession() without asking the user to log in again.
   */
  const snapshotCurrentSession = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user?.email) return;

    const current = readAccounts();
    const filtered = current.filter(a => a.email !== session.user!.email);
    const entry: SavedAccount = {
      email: session.user.email,
      lastLogin: new Date().toISOString(),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId: session.user.id,
    };
    // sanitizeAccounts (called inside persistAccounts) will strip tokens
    // from every entry except the current `session.user.email`.
    persistAccounts(sanitizeAccounts([entry, ...filtered], session.user.email));
  };

  const removeAccountFromStorage = (email: string) => {
    const filtered = savedAccounts.filter(acc => acc.email !== email);
    persistAccounts(filtered);
    setAccountToDelete(null);
    
    toast({
      title: t('switchAccount.accountRemoved'),
      description: email,
    });
  };

  const handleSwitchToAccount = async (account: SavedAccount) => {
    if (switchingEmail) return;
    setSwitchingEmail(account.email);

    try {
      // Always snapshot the current session first so we can switch back later.
      await snapshotCurrentSession();

      // If we have stored tokens, restore that session directly — no re-login.
      if (account.refreshToken && account.accessToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: account.accessToken,
          refresh_token: account.refreshToken,
        });

        if (error || !data.session) {
          // Refresh token expired/revoked — fall back to login screen.
          const remaining = readAccounts().filter(a => a.email !== account.email);
          persistAccounts([
            { email: account.email, lastLogin: account.lastLogin },
            ...remaining,
          ]);
          toast({
            variant: 'destructive',
            title: t('switchAccount.sessionExpired') || 'Phiên đã hết hạn',
            description: t('switchAccount.pleaseLoginAgain') || 'Vui lòng đăng nhập lại tài khoản này.',
          });
          await signOut();
          navigate('/login', { state: { prefillEmail: account.email } });
          return;
        }

        // Refresh stored tokens (Supabase may rotate the refresh token).
        const refreshed = data.session;
        const accounts = readAccounts().filter(a => a.email !== account.email);
        persistAccounts(sanitizeAccounts([
          {
            email: account.email,
            lastLogin: new Date().toISOString(),
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            userId: refreshed.user.id,
          },
          ...accounts,
        ], account.email));

        toast({
          title: t('switchAccount.switched') || 'Đã chuyển tài khoản',
          description: account.email,
        });
        navigate('/');
        return;
      }

      // Legacy entry without tokens — fall back to login flow.
      await signOut();
      navigate('/login', { state: { prefillEmail: account.email } });
    } catch (e) {
      console.error('Switch account failed:', e);
      toast({
        variant: 'destructive',
        title: t('common.failed') || 'Thất bại',
        description: (e as Error).message,
      });
    } finally {
      setSwitchingEmail(null);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(loginEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(loginPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.password = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoggingIn(true);

    try {
      // 1) Snapshot the current session BEFORE signing out so we can switch back.
      await snapshotCurrentSession();

      // 2) Sign out the current user (Supabase only supports one active session).
      await signOut();

      // 3) Sign in with the new account.
      const { error } = await signIn(loginEmail, loginPassword);
      if (error) {
        toast({
          variant: 'destructive',
          title: t('auth.login') + ' ' + t('common.failed'),
          description: error.message,
        });
        return;
      }

      // 4) Snapshot the new account's session too.
      await snapshotCurrentSession();

      toast({
        title: t('auth.login') + ' ' + t('common.success'),
        description: t('auth.welcomeSubtitle'),
      });

      setShowAddSheet(false);
      setLoginEmail('');
      setLoginPassword('');
      navigate('/');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Filter out current user from saved accounts
  const otherAccounts = savedAccounts.filter(acc => acc.email !== user?.email);

  return (
    <div className="min-h-screen bg-[#0b0f1d] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0b0f1d] border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-white/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold">{t('switchAccount.title')}</h1>
          <button
            onClick={() => setShowDeleteMode(!showDeleteMode)}
            className={`p-2 -mr-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              showDeleteMode ? 'text-red-500 bg-red-500/10' : 'hover:bg-white/10'
            }`}
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {/* Current Account */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">{t('switchAccount.currentAccount')}</h2>
          <div 
            className="relative bg-[#1a1f2e] rounded-xl p-4 flex items-center gap-3 transition-all duration-200 active:scale-[0.99] overflow-hidden"
          >
            <Avatar className="h-12 w-12 bg-green-500">
              <AvatarFallback className="bg-green-500 text-white text-lg font-bold">
                {getInitials(user?.email || '')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user?.email}</p>
              <p className="text-xs text-gray-400">
                {t('switchAccount.lastLogin')}: {formatLastLogin(lastLoginAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Other Accounts */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-3">{t('switchAccount.otherAccounts')}</h2>
          
          {otherAccounts.length > 0 && (
            <div className="space-y-2 mb-4">
              {otherAccounts.map((account, index) => (
                <div
                  key={account.email}
                  className="relative bg-[#1a1f2e] rounded-xl p-4 flex items-center gap-3 transition-all duration-200 active:scale-[0.99] overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Avatar className="h-12 w-12 bg-gray-600">
                    <AvatarFallback className="bg-gray-600 text-white text-lg font-bold">
                      {getInitials(account.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{account.email}</p>
                    <p className="text-xs text-gray-400">
                      {t('switchAccount.lastLogin')}: {formatLastLogin(account.lastLogin)}
                    </p>
                  </div>
                  {showDeleteMode ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAccountToDelete(account.email);
                      }}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={switchingEmail === account.email}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchToAccount(account);
                      }}
                      className="text-green-400 hover:text-green-300 hover:bg-green-400/10 active:scale-95 transition-all duration-200"
                    >
                      {switchingEmail === account.email ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : account.refreshToken ? (
                        t('switchAccount.switch')
                      ) : (
                        <span className="flex items-center gap-1">
                          <LogIn className="h-3.5 w-3.5" />
                          {t('switchAccount.switch')}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add New Account Button */}
          <Button
            onClick={() => setShowAddSheet(true)}
            className="relative w-full bg-red-500 hover:bg-red-600 text-white py-6 active:scale-[0.98] transition-all duration-200 overflow-hidden"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('switchAccount.addNewAccount')}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={() => setAccountToDelete(null)}>
        <AlertDialogContent className="bg-[#1a1f2e] border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t('switchAccount.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('switchAccount.deleteConfirmDesc')} <strong>{accountToDelete}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => accountToDelete && removeAccountFromStorage(accountToDelete)}
              className="bg-red-500 hover:bg-red-600"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Account Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="bottom" className="bg-[#0b0f1d] border-t border-gray-700 text-white max-h-[80vh]">
          <SheetHeader>
            <SheetTitle className="text-white">{t('switchAccount.addNewAccount')}</SheetTitle>
          </SheetHeader>
          
          <form onSubmit={handleAddAccount} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('auth.email')}</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder={t('auth.enterEmail')}
                className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                disabled={isLoggingIn}
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">{t('auth.password')}</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder={t('auth.enterPassword')}
                className="w-full bg-[#1a1f2e] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
                disabled={isLoggingIn}
              />
              {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password}</p>}
            </div>
            
            <Button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-6"
            >
              {isLoggingIn ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('auth.loggingIn')}
                </span>
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
