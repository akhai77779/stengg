import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Loader2, Eye, EyeOff, ChevronLeft, Headphones } from 'lucide-react';
import { z } from 'zod';
import { GuestFooter } from '@/components/guest/GuestFooter';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('email');
  const [rememberMe, setRememberMe] = useState(false);
  
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const emailSchema = z.string().email(t('auth.email') + ' không hợp lệ');
  const passwordSchema = z.string().min(6, t('auth.password') + ' phải có ít nhất 6 ký tự');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateLoginForm = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      emailSchema.parse(loginEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.loginEmail = e.errors[0].message;
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
    
    setIsLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    setIsLoading(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: t('auth.login') + ' thất bại',
        description: error.message,
      });
      return;
    }
    
    toast({
      title: t('auth.login') + ' thành công',
      description: t('auth.welcomeSubtitle'),
    });
    
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
              <a href="#" className="text-red-500 hover:text-red-400" title="Support">
                <Headphones className="h-4 w-4" />
              </a>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-[#1a1f2e] border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
              >
                <option value="vi" className="bg-[#1a1f2e]">🇻🇳 Tiếng Việt</option>
                <option value="en" className="bg-[#1a1f2e]">🇬🇧 English</option>
                <option value="zh" className="bg-[#1a1f2e]">🇨🇳 中文</option>
                <option value="th" className="bg-[#1a1f2e]">🇹🇭 ไทย</option>
                <option value="ja" className="bg-[#1a1f2e]">🇯🇵 日本語</option>
                <option value="ko" className="bg-[#1a1f2e]">🇰🇷 한국어</option>
                <option value="id" className="bg-[#1a1f2e]">🇮🇩 Indonesia</option>
                <option value="ms" className="bg-[#1a1f2e]">🇲🇾 Melayu</option>
              </select>
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
            <h1 className="text-2xl font-semibold">{t('auth.welcomeTitle')}</h1>
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

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            {loginMethod === 'email' ? (
              <div className="border-b border-gray-700 pb-3">
                <input
                  type="email"
                  placeholder={t('auth.enterEmail')}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-transparent text-sm placeholder:text-gray-500 outline-none"
                  disabled={isLoading}
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
                  placeholder={t('auth.enterPhone')}
                  className="flex-1 bg-transparent text-sm placeholder:text-gray-500 outline-none"
                  disabled={isLoading}
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
    </div>
  );
}
