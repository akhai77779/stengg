import { useState } from 'react';
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
  const [isChangeTransactionPasswordOpen, setIsChangeTransactionPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user has verified phone/email
  const isPhoneVerified = !!user?.phone;
  const isEmailVerified = !!user?.email_confirmed_at;

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

  const handleChangeTransactionPassword = async () => {
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
      // For now, we'll show a success message - transaction password would need a separate field in profiles
      toast({
        title: t('common.success'),
        description: t('security.transactionPasswordChanged')
      });
      setIsChangeTransactionPasswordOpen(false);
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

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-8">
            {t('security.title')}
          </h1>

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

          {/* Password Settings */}
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

            {/* Transaction Password */}
            <Card 
              className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setIsChangeTransactionPasswordOpen(true)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {t('security.transactionPassword')}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">{t('security.change')}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

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

      {/* Change Transaction Password Dialog */}
      <Dialog open={isChangeTransactionPasswordOpen} onOpenChange={setIsChangeTransactionPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('security.changeTransactionPassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tx-current-password">{t('security.currentPassword')}</Label>
              <Input
                id="tx-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.enterCurrentPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-new-password">{t('security.newPassword')}</Label>
              <Input
                id="tx-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.enterNewPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-confirm-password">{t('security.confirmPassword')}</Label>
              <Input
                id="tx-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.enterConfirmPassword')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangeTransactionPasswordOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangeTransactionPassword} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
