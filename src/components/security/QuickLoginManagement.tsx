import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useQuickLogin } from '@/hooks/useQuickLogin';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Fingerprint, 
  KeyRound, 
  Trash2, 
  RefreshCw,
  ChevronRight,
  Check,
  AlertCircle,
  Smartphone
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickLoginManagementProps {
  onSetupNew: () => void;
}

export function QuickLoginManagement({ onSetupNew }: QuickLoginManagementProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isAvailable, method, email, clearQuickLogin, isBiometricSupported } = useQuickLogin();
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleDelete = () => {
    clearQuickLogin();
    setIsDeleteDialogOpen(false);
    toast({
      title: t('common.success'),
      description: t('quickLogin.deleted'),
    });
  };

  const getMethodIcon = () => {
    if (method === 'biometric') {
      return <Fingerprint className="w-5 h-5" />;
    }
    return <KeyRound className="w-5 h-5" />;
  };

  const getMethodName = () => {
    if (method === 'biometric') {
      return t('quickLogin.biometricMethod');
    }
    return t('quickLogin.pinMethod');
  };

  return (
    <div className="space-y-3">
      {/* Quick Login Status Card */}
      <Card className={cn(
        "bg-card border-border",
        isAvailable ? "border-green-500/30" : "border-muted"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                isAvailable ? "bg-green-500/20 text-green-500" : "bg-muted text-muted-foreground"
              )}>
                {isAvailable ? getMethodIcon() : <Smartphone className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-medium text-foreground">
                  {t('quickLogin.title')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isAvailable 
                    ? `${getMethodName()} • ${email}`
                    : t('quickLogin.notSetup')
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAvailable ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isAvailable ? (
        <div className="grid grid-cols-2 gap-3">
          {/* Change Method */}
          <Card 
            className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={onSetupNew}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground">
                  {t('quickLogin.changeMethod')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>

          {/* Delete */}
          <Card 
            className="bg-card border-border cursor-pointer hover:bg-destructive/10 transition-colors"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground">
                  {t('quickLogin.delete')}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card 
          className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={onSetupNew}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-sm text-foreground">
                  {t('quickLogin.setup')}
                </span>
                <p className="text-xs text-muted-foreground">
                  {isBiometricSupported 
                    ? t('quickLogin.setupDescBiometric')
                    : t('quickLogin.setupDescPin')
                  }
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('quickLogin.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('quickLogin.deleteDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
