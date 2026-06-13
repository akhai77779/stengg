import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuickLogin } from '@/hooks/useQuickLogin';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { KeyRound, Loader2, X, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface QuickLoginUnlockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: (email: string, password: string) => void;
  onSwitchAccount: () => void;
}

export function QuickLoginUnlock({
  open,
  onOpenChange,
  onUnlock,
  onSwitchAccount,
}: QuickLoginUnlockProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { method, email, unlockWithPin, clearQuickLogin } = useQuickLogin();
  
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 5;

  const handlePinUnlock = async () => {
    if (pin.length !== 6) return;

    setIsLoading(true);
    const credentials = await unlockWithPin(pin);
    setIsLoading(false);

    if (credentials) {
      onUnlock(credentials.email, credentials.password);
      onOpenChange(false);
      setPin('');
      setAttempts(0);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');

      if (newAttempts >= MAX_ATTEMPTS) {
        toast({
          variant: 'destructive',
          title: t('quickLogin.maxAttempts'),
          description: t('quickLogin.maxAttemptsDesc'),
        });
        clearQuickLogin();
        onOpenChange(false);
        onSwitchAccount();
      } else {
        toast({
          variant: 'destructive',
          title: t('quickLogin.wrongPin'),
          description: t('quickLogin.attemptsRemaining', { count: MAX_ATTEMPTS - newAttempts }),
        });
      }
    }
  };

  const handleClose = () => {
    setPin('');
    onOpenChange(false);
  };

  const handleUsePassword = () => {
    handleClose();
    onSwitchAccount();
  };

  const getInitials = (email: string | null) => {
    return email?.charAt(0).toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1f2e] border-gray-700 text-white max-w-sm">
        <DialogHeader className="items-center text-center">
          <Avatar className="h-16 w-16 bg-green-500 mb-2">
            <AvatarFallback className="bg-green-500 text-white text-2xl font-bold">
              {getInitials(email)}
            </AvatarFallback>
          </Avatar>
          <DialogTitle className="text-white">
            {t('quickLogin.welcomeBack')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {email}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {method === 'pin' && (
            <div className="flex flex-col items-center gap-6">
              <p className="text-sm text-gray-400">{t('quickLogin.enterYourPin')}</p>
              
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={setPin}
                onComplete={handlePinUnlock}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="w-12 h-14 text-xl bg-[#0b0f1d] border-gray-700 text-white"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <Button
                onClick={handlePinUnlock}
                disabled={pin.length !== 6 || isLoading}
                className="w-full bg-red-500 hover:bg-red-600"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('auth.loggingIn')}
                  </span>
                ) : (
                  t('quickLogin.unlock')
                )}
              </Button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-700">
            <Button
              onClick={handleUsePassword}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-transparent"
            >
              <User className="h-4 w-4 mr-2" />
              {t('quickLogin.usePassword')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
