import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveChat } from '@/contexts/LiveChatContext';
import { LanguageSelect } from '@/components/settings/LanguageSelect';
import { Loader2, Eye, EyeOff, ChevronLeft, Headphones } from 'lucide-react';
import { z } from 'zod';
import { GuestFooter } from '@/components/guest/GuestFooter';

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [registerMethod, setRegisterMethod] = useState<'phone' | 'email'>('phone');
  
  const { user, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { openChat } = useLiveChat();

  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');

  const emailSchema = z.string().email(t('auth.email') + ' không hợp lệ');
  const passwordSchema = z.string().min(6, t('auth.password') + ' phải có ít nhất 6 ký tự');
  const nameSchema = z.string().min(2, t('auth.fullName') + ' phải có ít nhất 2 ký tự');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateRegisterForm = () => {
    const newErrors: Record<string, string> = {};
    
    try {
      nameSchema.parse(registerName);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.registerName = e.errors[0].message;
      }
    }
    
    try {
      emailSchema.parse(registerEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.registerEmail = e.errors[0].message;
      }
    }
    
    try {
      passwordSchema.parse(registerPassword);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.registerPassword = e.errors[0].message;
      }
    }

    if (registerPassword !== registerConfirmPassword) {
      newErrors.registerConfirmPassword = t('auth.confirmPassword') + ' không khớp';
    }

    if (!agreeTerms) {
      newErrors.agreeTerms = 'Vui lòng đồng ý với điều khoản';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRegisterForm()) return;
    
    setIsLoading(true);
    
    const { error } = await signUp(registerEmail, registerPassword, registerName);
    
    setIsLoading(false);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: t('auth.register') + ' thất bại',
        description: error.message,
      });
      return;
    }
    
    toast({
      title: t('auth.register') + ' thành công',
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
            <button 
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-medium">{t('auth.register')}</h1>
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

          {/* Register method tabs */}
          <div className="mt-8 flex items-center gap-8 text-sm">
            <button 
              onClick={() => setRegisterMethod('phone')}
              className={`pb-2 border-b-2 ${registerMethod === 'phone' ? 'text-red-500 border-red-500' : 'text-gray-400 border-transparent'}`}
            >
              {t('auth.registerByPhone')}
            </button>
            <button 
              onClick={() => setRegisterMethod('email')}
              className={`pb-2 border-b-2 ${registerMethod === 'email' ? 'text-red-500 border-red-500' : 'text-gray-400 border-transparent'}`}
            >
              {t('auth.registerByEmail')}
            </button>
          </div>

          <div className="mt-6 space-y-6">
            <form onSubmit={handleRegister} className="space-y-5">
              <div>
                <label className="text-sm text-gray-300">{t('auth.fullName')}</label>
                <input
                  placeholder={t('auth.enterName')}
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full mt-2 bg-transparent border-b border-gray-700 pb-2 text-sm outline-none placeholder:text-gray-500"
                  disabled={isLoading}
                />
                {errors.registerName && (
                  <p className="text-sm text-red-500 mt-1">{errors.registerName}</p>
                )}
              </div>

              {registerMethod === 'email' ? (
                <div>
                  <label className="text-sm text-gray-300">{t('auth.email')}</label>
                  <input
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full mt-2 bg-transparent border-b border-gray-700 pb-2 text-sm outline-none placeholder:text-gray-500"
                    disabled={isLoading}
                  />
                  {errors.registerEmail && (
                    <p className="text-sm text-red-500 mt-1">{errors.registerEmail}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-sm text-gray-300">{t('auth.phone')}</label>
                  <div className="flex items-center gap-3 mt-2 border-b border-gray-700 pb-2">
                    <select className="w-[64px] shrink-0 bg-[#1a1f2e] text-sm text-gray-300 outline-none border border-gray-700 rounded px-2 py-1">
                      <option className="bg-[#1a1f2e]">+84</option>
                      <option className="bg-[#1a1f2e]">+65</option>
                      <option className="bg-[#1a1f2e]">+66</option>
                    </select>
                    <input
                      placeholder={t('auth.enterPhone')}
                      value={registerPhone}
                      onChange={(e) => setRegisterPhone(e.target.value)}
                      className="flex-1 bg-transparent text-sm placeholder:text-gray-500 outline-none"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.registerPhone && (
                    <p className="text-sm text-red-500 mt-1">{errors.registerPhone}</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-gray-300">{t('auth.password')}</label>
                <div className="mt-2 flex items-center gap-3 border-b border-gray-700 pb-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.enterPassword')}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
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
                {errors.registerPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.registerPassword}</p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-300">{t('auth.confirmPassword')}</label>
                <div className="mt-2 flex items-center gap-3 border-b border-gray-700 pb-2">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={t('auth.enterConfirmPassword')}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="flex-1 bg-transparent text-sm placeholder:text-gray-500 outline-none"
                    disabled={isLoading}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.registerConfirmPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.registerConfirmPassword}</p>
                )}
              </div>

              <label className="flex items-start gap-2 text-xs text-gray-300">
                <input 
                  type="checkbox" 
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="accent-red-500 mt-0.5" 
                />
                <span>
                  {t('auth.agreeTerms')}{' '}
                  <span className="text-red-500">{t('auth.userAgreement')}</span>
                  {' & '}
                  <span className="text-red-500">{t('auth.privacyPolicy')}</span>
                </span>
              </label>
              {errors.agreeTerms && (
                <p className="text-sm text-red-500">{errors.agreeTerms}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-500 text-white py-3 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('auth.registering')}
                  </span>
                ) : (
                  t('auth.register')
                )}
              </button>
            </form>

            <div className="text-center text-xs text-gray-400">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" className="text-red-500">
                {t('auth.loginHere')}
              </Link>
            </div>
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
