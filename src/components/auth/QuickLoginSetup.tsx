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
import { Fingerprint, KeyRound, Loader2, X } from 'lucide-react';

interface QuickLoginSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  onComplete: () => void;
}

export function QuickLoginSetup({
  open,
  onOpenChange,
  email,
  password,
  onComplete,
}: QuickLoginSetupProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { setupPinLogin, setupBiometricLogin, isBiometricSupported } = useQuickLogin();
  
  const [step, setStep] = useState<'choose' | 'pin-setup' | 'pin-confirm'>('choose');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handlePinSetup = () => {
    setStep('pin-setup');
    setPin('');
    setConfirmPin('');
  };

  const handlePinEntered = () => {
    if (pin.length === 6) {
      setStep('pin-confirm');
    }
  };

  const handleConfirmPin = async () => {
    if (confirmPin !== pin) {
      toast({
        variant: 'destructive',
        title: t('quickLogin.pinMismatch'),
        description: t('quickLogin.pinMismatchDesc'),
      });
      setConfirmPin('');
      return;
    }

    setIsLoading(true);
    const success = await setupPinLogin(email, password, pin);
    setIsLoading(false);

    if (success) {
      toast({
        title: t('quickLogin.setupSuccess'),
        description: t('quickLogin.pinSetupSuccess'),
      });
      onComplete();
      onOpenChange(false);
    } else {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('quickLogin.setupFailed'),
      });
    }
  };

  const handleBiometricSetup = async () => {
    setIsLoading(true);
    const success = await setupBiometricLogin(email, password);
    setIsLoading(false);

    if (success) {
      toast({
        title: t('quickLogin.setupSuccess'),
        description: t('quickLogin.biometricSetupSuccess'),
      });
      onComplete();
      onOpenChange(false);
    } else {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('quickLogin.biometricSetupFailed'),
      });
    }
  };

  const handleSkip = () => {
    onComplete();
    onOpenChange(false);
  };

  const handleClose = () => {
    setStep('choose');
    setPin('');
    setConfirmPin('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1f2e] border-gray-700 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">
            {step === 'choose' && t('quickLogin.setupTitle')}
            {step === 'pin-setup' && t('quickLogin.enterPin')}
            {step === 'pin-confirm' && t('quickLogin.confirmPin')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {step === 'choose' && t('quickLogin.setupDesc')}
            {step === 'pin-setup' && t('quickLogin.enterPinDesc')}
            {step === 'pin-confirm' && t('quickLogin.confirmPinDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'choose' && (
            <div className="space-y-3">
              <Button
                onClick={handlePinSetup}
                className="w-full bg-[#0b0f1d] hover:bg-[#0b0f1d]/80 border border-gray-700 justify-start gap-3 py-6"
                variant="outline"
              >
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-white">{t('quickLogin.pinMethod')}</p>
                  <p className="text-xs text-gray-400">{t('quickLogin.pinMethodDesc')}</p>
                </div>
              </Button>

              {isBiometricSupported && (
                <Button
                  onClick={handleBiometricSetup}
                  disabled={isLoading}
                  className="w-full bg-[#0b0f1d] hover:bg-[#0b0f1d]/80 border border-gray-700 justify-start gap-3 py-6"
                  variant="outline"
                >
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Fingerprint className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-white">{t('quickLogin.biometricMethod')}</p>
                    <p className="text-xs text-gray-400">{t('quickLogin.biometricMethodDesc')}</p>
                  </div>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
                </Button>
              )}

              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full text-gray-400 hover:text-white hover:bg-transparent"
              >
                {t('quickLogin.skip')}
              </Button>
            </div>
          )}

          {step === 'pin-setup' && (
            <div className="flex flex-col items-center gap-6">
              <InputOTP
                maxLength={6}
                value={pin}
                onChange={setPin}
                onComplete={handlePinEntered}
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
                onClick={handlePinEntered}
                disabled={pin.length !== 6}
                className="w-full bg-red-500 hover:bg-red-600"
              >
                {t('common.confirm')}
              </Button>

              <Button
                onClick={() => setStep('choose')}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                {t('common.back')}
              </Button>
            </div>
          )}

          {step === 'pin-confirm' && (
            <div className="flex flex-col items-center gap-6">
              <InputOTP
                maxLength={6}
                value={confirmPin}
                onChange={setConfirmPin}
                onComplete={handleConfirmPin}
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
                onClick={handleConfirmPin}
                disabled={confirmPin.length !== 6 || isLoading}
                className="w-full bg-red-500 hover:bg-red-600"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.processing')}
                  </span>
                ) : (
                  t('quickLogin.setupComplete')
                )}
              </Button>

              <Button
                onClick={() => {
                  setStep('pin-setup');
                  setConfirmPin('');
                }}
                variant="ghost"
                className="text-gray-400 hover:text-white"
              >
                {t('common.back')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
