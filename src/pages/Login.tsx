import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuickLogin } from '@/hooks/useQuickLogin';
import { useLiveChat } from '@/contexts/LiveChatContext';
import { LanguageSelect } from '@/components/settings/LanguageSelect';
import { Loader2, Eye, EyeOff, ChevronLeft, Headphones } from 'lucide-react';
import { Typewriter } from '@/components/ui/typewriter';
import { z } from 'zod';
import { translateAuthError } from '@/lib/authErrors';
import { GuestFooter } from '@/components/guest/GuestFooter';
import { QuickLoginSetup } from '@/components/auth/QuickLoginSetup';
import { QuickLoginUnlock } from '@/components/auth/QuickLoginUnlock';

interface LocationState {
  prefillEmail?: string;
  skipQuickLogin?: boolean;
}

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [rememberMe, setRememberMe] = useState(false);
  const [showQuickLoginSetup, setShowQuickLoginSetup] = useState(false);
  const [showQuickLoginUnlock, setShowQuickLoginUnlock] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const quickLogin = useQuickLogin();
  const { openChat } = useLiveChat();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const emailSchema = z.string().email(t('auth.email') + ' không hợp lệ');
  const passwordSchema = z.string().min(6, t('auth.password') + ' phải có ít nhất 6 ký tự');

  // Check if quick login is available on mount
  useEffect(() => {
    const state = location.state as LocationState;
    if (quickLogin.isAvailable && quickLogin.email && !state?.skipQuickLogin) {
      setShowQuickLoginUnlock(true);
    }
  }, [quickLogin.isAvailable, quickLogin.email, location.state]);

  // Handle prefill email from Switch Account page
  useEffect(() => {
    const state = location.state as LocationState;
    if (state?.prefillEmail) {
      setLoginEmail(state.prefillEmail);
      setLoginMethod('email'); // Switch to email method
      // Clear the state to prevent re-filling on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateLoginForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (loginMethod === 'email') {
      try {
        emailSchema.parse(loginEmail);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.loginEmail = e.errors[0].message;
        }
      }
    } else {
      // Phone login — still requires email internally but show phone-friendly message
      if (!loginEmail || !loginEmail.includes('@')) {
        newErrors.loginEmail = 'SĐT không hợp lệ';
      }
    }
    
    try {
      passwordSchema.parse(loginPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.loginPassword = e.errors[0].message;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateLoginForm()) return;
    
    await performLogin(loginEmail, loginPassword);
  };

  const performLogin = async (email: string, password: string) => {
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    setIsLoading(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: t('auth.login') + ' thất bại',
        description: translateAuthError(error.message),
      });
      return;
    }
    
    toast({
      title: t('auth.login') + ' thành công',
      description: t('auth.welcomeSubtitle'),
    });
    
    // Check if quick login is already set up for this email
    if (!quickLogin.isSetupForEmail(email)) {
      // Show quick login setup dialog
      setPendingCredentials({ email, password });
      setShowQuickLoginSetup(true);
    } else {
      navigate('/');
    }
  };

  const handleQuickLoginUnlock = async (email: string, password: string) => {
    await performLogin(email, password);
  };

  const handleSwitchToPasswordLogin = () => {
    setShowQuickLoginUnlock(false);
    // Navigate with flag to skip quick login prompt
    navigate(location.pathname, { replace: true, state: { skipQuickLogin: true } });
  };

  const handleQuickLoginSetupComplete = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0b0f1d] text-white flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="relative z-10 max-w-md mx-auto px-4 pt-10 pb-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="https://www.stengg.com/images/st-logo-color-footer.png"
                alt="ST Engineering"
                className="h-6 w-auto"
              />
            </Link>
            <div className="flex items-center gap-3">
              <button 
                onClick={openChat}
                className="group relative p-2 -m-2 text-red-500 hover:text-red-400 transition-all duration-300 hover:scale-110" 
                title="Support"
              >
                <span className="absolute inset-0 rounded-full bg-red-500/0 group-hover:bg-red-500/10 transition-all duration-300 group-hover:scale-125" />
                <Headphones className="h-4 w-4 relative z-10 transition-transform duration-300 group-hover:animate-[wiggle_0.5s_ease-in-out]" />
              </button>
              <LanguageSelect />
            </div>
          </div>

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="mt-6 inline-flex items-center gap-2 text-gray-300 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Login Form */}
          <div className="mt-8 space-y-1">
            <h1 className="text-2xl font-semibold">
              <Typewriter text={t('auth.welcomeTitle')} speed={60} />
            </h1>
            <p className="text-sm text-gray-400">{t('auth.welcomeSubtitle')}</p>
            <p className="text-sm text-gray-400">{t('auth.internalPortal')}</p>
          </div>

          {/* Login method tabs */}
          <div className="mt-8 flex items-center gap-8 text-sm">
            <button 
              onClick={() => setLoginMethod('phone')}
              className={`pb-2 border-b-2 ${loginMethod === 'phone' ? 'text-red-500 border-red-500' : 'text-gray-400 border-transparent'}`}
            >
              {t('auth.loginByPhone')}
            </button>
            <button 
              onClick={() => setLoginMethod('email')}
              className={`pb-2 border-b-2 ${loginMethod === 'email' ? 'text-red-500 border-red-500' : 'text-gray-400 border-transparent'}`}
            >
              {t('auth.loginByEmail')}
            </button>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6" key={loginMethod}>
            {loginMethod === 'email' ? (
              <div className="border-b border-gray-700 pb-3">
                <input
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-transparent text-sm placeholder:text-gray-500 outline-none"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 border-b border-gray-700 pb-3">
                <select className="w-[64px] shrink-0 bg-[#1a1f2e] text-sm text-gray-300 outline-none border border-gray-700 rounded px-2 py-1">
                  <option className="bg-[#1a1f2e]">+84</option>
                  <option className="bg-[#1a1f2e]">+65</option>
                  <option className="bg-[#1a1f2e]">+66</option>
                </select>
                <input
                  type="tel"
                  placeholder={t('auth.enterPhone')}
                  className="flex-1 bg-transparent text-sm placeholder:text-gray-500 outline-none"
                  disabled={isLoading}
                  autoComplete="tel"
                />
              </div>
            )}
            {errors.loginEmail && (
              <p className="text-sm text-red-500">{errors.loginEmail}</p>
            )}

            <div className="flex items-center gap-3 border-b border-gray-700 pb-3">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.enterPassword')}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm placeholder:text-gray-500 outline-none"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.loginPassword && (
              <p className="text-sm text-red-500">{errors.loginPassword}</p>
            )}

            <div className="flex items-center justify-between text-xs text-gray-300">
              <label className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="accent-red-500" 
                />
                {t('auth.rememberMe')}
              </label>
              <button type="button" className="text-red-500">{t('auth.forgotPassword')}</button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-500 text-white py-3 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('auth.loggingIn')}
                </span>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-400">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-red-500">
              {t('auth.registerHere')}
            </Link>
          </div>

          {/* Promo Card */}
          <div className="mt-8 rounded-2xl overflow-hidden border border-gray-800 bg-[#0f1426]">
            <div className="relative">
              <div className="absolute -top-12 -left-12 h-28 w-28 rounded-full bg-teal-400/40 promo-blob"></div>
              <div className="absolute -bottom-16 -right-10 h-32 w-32 rounded-full bg-blue-400/35 promo-blob"></div>
              <img
                src="https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80"
                alt="Smart City"
                className="h-40 w-full object-cover opacity-90"
              />
              <div className="absolute inset-0 hero-overlay"></div>
              <div className="absolute inset-0 p-4 flex flex-col justify-end gap-2">
                <h3 className="text-lg font-semibold text-white">{t('auth.smartCitySolution')}</h3>
                <p className="text-xs text-gray-200 leading-relaxed">
                  {t('auth.smartCityDesc')}
                </p>
                <button className="self-start text-xs px-3 py-1.5 rounded-md bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors">
                  {t('auth.learnMore')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <GuestFooter />

      {/* Quick Login Setup Dialog */}
      {pendingCredentials && (
        <QuickLoginSetup
          open={showQuickLoginSetup}
          onOpenChange={setShowQuickLoginSetup}
          email={pendingCredentials.email}
          password={pendingCredentials.password}
          onComplete={handleQuickLoginSetupComplete}
        />
      )}

      {/* Quick Login Unlock Dialog */}
      <QuickLoginUnlock
        open={showQuickLoginUnlock}
        onOpenChange={setShowQuickLoginUnlock}
        onUnlock={handleQuickLoginUnlock}
        onSwitchAccount={handleSwitchToPasswordLogin}
      />
    </div>
  );
}
