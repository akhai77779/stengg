import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QuickLoginManagement } from '@/components/security/QuickLoginManagement';
import { QuickLoginSetup } from '@/components/auth/QuickLoginSetup';
import { 
  ArrowLeft,
  Smartphone,
  Mail,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SecuritySettings() {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isWithdrawalPasswordOpen, setIsWithdrawalPasswordOpen] = useState(false);
  const [hasWithdrawalPassword, setHasWithdrawalPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickLoginSetup, setShowQuickLoginSetup] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);
  
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user has verified phone/email
  const isPhoneVerified = !!user?.phone;
  const isEmailVerified = !!user?.email_confirmed_at;

  // Fetch withdrawal password status using secure RPC (never exposes hash)
  useEffect(() => {
    const fetchWithdrawalPasswordStatus = async () => {
      if (!user?.id) return;
      
      // Use SECURITY DEFINER function that checks existence without exposing hash
      const { data, error } = await supabase
        .rpc('has_withdrawal_password', { _user_id: user.id });
      
      if (!error) {
        setHasWithdrawalPassword(data === true);
      }
    };
    
    fetchWithdrawalPasswordStatus();
  }, [user?.id]);

  const handleChangeLoginPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('security.passwordMismatch'),
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('security.passwordTooShort'),
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('security.passwordChanged')
      });
      setIsChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawalPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('security.passwordMismatch'),
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('security.passwordTooShort'),
        variant: 'destructive'
      });
      return;
    }

    if (hasWithdrawalPassword && !currentPassword) {
      toast({
        title: t('common.error'),
        description: t('security.enterCurrentPassword'),
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Call server-side edge function for secure password handling
      const { data, error } = await supabase.functions.invoke('withdrawal-password', {
        body: {
          action: hasWithdrawalPassword ? 'change' : 'create',
          currentPassword: hasWithdrawalPassword ? currentPassword : undefined,
          newPassword
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to update password');
      }
      
      toast({
        title: t('common.success'),
        description: hasWithdrawalPassword 
          ? t('security.withdrawalPasswordChanged')
          : t('security.withdrawalPasswordCreated')
      });
      setHasWithdrawalPassword(true);
      setIsWithdrawalPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Withdrawal password error:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('common.error'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            <h1 className="text-xl font-bold text-foreground">
              {t('security.title')}
            </h1>
          </div>

          {/* Two-Factor Authentication */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-foreground mb-2">
              {t('security.twoFactorAuth')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {t('security.twoFactorDesc')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Phone Verification */}
              <Card className={cn(
                "bg-card border-border cursor-pointer transition-colors",
                isPhoneVerified ? "border-green-500/30" : "border-orange-500/30"
              )}>
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                      isPhoneVerified ? "bg-green-500" : "bg-orange-500"
                    )}>
                      {isPhoneVerified ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('security.verifyPhone')}
                  </span>
                </CardContent>
              </Card>

              {/* Email Verification */}
              <Card className={cn(
                "bg-card border-border cursor-pointer transition-colors",
                isEmailVerified ? "border-green-500/30" : "border-orange-500/30"
              )}>
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <Mail className="w-8 h-8 text-muted-foreground" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                      isEmailVerified ? "bg-green-500" : "bg-orange-500"
                    )}>
                      {isEmailVerified ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('security.verifyEmail')}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Login Management */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-foreground mb-2">
              {t('quickLogin.title')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {t('quickLogin.manageDesc')}
            </p>
            
            <QuickLoginManagement 
              onSetupNew={() => {
                // For setup from settings, we need to prompt for password first
                setTempCredentials({ email: user?.email || '', password: '' });
                setShowQuickLoginSetup(true);
              }}
            />
          </div>

          {/* Password Settings */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-foreground mb-2">
              {t('security.passwords')}
            </h2>
            <div className="space-y-3">
              {/* Login Password */}
              <Card 
                className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setIsChangePasswordOpen(true)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    {t('security.loginPassword')}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">{t('security.change')}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>

              {/* Withdrawal Password */}
              <Card 
                className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setIsWithdrawalPasswordOpen(true)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <span className="text-sm text-foreground">
                    {t('security.withdrawalPassword')}
                  </span>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">
                      {hasWithdrawalPassword ? t('security.change') : t('security.create')}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </div>
      </div>
      
      {/* Quick Login Setup Dialog */}
      {tempCredentials && (
        <QuickLoginSetup
          open={showQuickLoginSetup}
          onOpenChange={(open) => {
            setShowQuickLoginSetup(open);
            if (!open) setTempCredentials(null);
          }}
          email={tempCredentials.email}
          password={tempCredentials.password}
          onComplete={() => {
            setShowQuickLoginSetup(false);
            setTempCredentials(null);
          }}
        />
      )}

      {/* Change Login Password Dialog */}
      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('security.changeLoginPassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('security.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.enterCurrentPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('security.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.enterNewPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('security.confirmPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.enterConfirmPassword')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangeLoginPassword} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Password Dialog */}
      <Dialog open={isWithdrawalPasswordOpen} onOpenChange={setIsWithdrawalPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasWithdrawalPassword 
                ? t('security.changeWithdrawalPassword')
                : t('security.createWithdrawalPassword')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {hasWithdrawalPassword && (
              <div className="space-y-2">
                <Label htmlFor="wd-current-password">{t('security.currentPassword')}</Label>
                <Input
                  id="wd-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder={t('security.enterCurrentPassword')}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="wd-new-password">{t('security.newPassword')}</Label>
              <Input
                id="wd-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.enterNewPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wd-confirm-password">{t('security.confirmPassword')}</Label>
              <Input
                id="wd-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.enterConfirmPassword')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawalPasswordOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleWithdrawalPassword} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
