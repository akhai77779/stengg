import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, Trash2, Plus, Loader2 } from 'lucide-react';
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
        setSavedAccounts(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing saved accounts:', e);
      }
    }
  }, []);

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

  const saveAccountToStorage = (email: string) => {
    const now = new Date().toISOString();
    const newAccount: SavedAccount = { email, lastLogin: now };
    
    // Remove if already exists, then add to front
    const filtered = savedAccounts.filter(acc => acc.email !== email);
    const updated = [newAccount, ...filtered];
    
    setSavedAccounts(updated);
    localStorage.setItem('savedAccounts', JSON.stringify(updated));
  };

  const removeAccountFromStorage = (email: string) => {
    const filtered = savedAccounts.filter(acc => acc.email !== email);
    setSavedAccounts(filtered);
    localStorage.setItem('savedAccounts', JSON.stringify(filtered));
    setAccountToDelete(null);
    
    toast({
      title: t('switchAccount.accountRemoved'),
      description: email,
    });
  };

  const handleSwitchToAccount = async (email: string) => {
    // Save current account before switching
    if (user?.email) {
      saveAccountToStorage(user.email);
    }
    
    // Sign out and navigate to login with prefilled email
    await signOut();
    navigate('/login', { state: { prefillEmail: email } });
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
    
    // Save current account before switching
    if (user?.email) {
      saveAccountToStorage(user.email);
    }
    
    // Sign out first
    await signOut();
    
    // Then sign in with new account
    const { error } = await signIn(loginEmail, loginPassword);
    
    setIsLoggingIn(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: t('auth.login') + ' ' + t('common.failed'),
        description: error.message,
      });
      return;
    }
    
    // Save new account
    saveAccountToStorage(loginEmail);
    
    toast({
      title: t('auth.login') + ' ' + t('common.success'),
      description: t('auth.welcomeSubtitle'),
    });
    
    setShowAddSheet(false);
    navigate('/');
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwitchToAccount(account.email);
                      }}
                      className="text-green-400 hover:text-green-300 hover:bg-green-400/10 active:scale-95 transition-all duration-200"
                    >
                      {t('switchAccount.switch')}
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
