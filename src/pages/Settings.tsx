import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChevronLeft, ChevronRight, Sun, Moon, Info, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import stEngineeringLogo from '@/assets/st-engineering-logo.png';

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { currency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const themeLabel = mounted 
    ? (theme === 'dark' ? t('settings.darkMode') : t('settings.lightMode'))
    : t('settings.darkMode');

  const handleThemeChange = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const currentLanguage = languages.find((l) => l.code === language);

  const handleLanguageSelect = (code: Language) => {
    setLanguage(code);
    setLanguageSheetOpen(false);
  };

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center mb-4 active:bg-muted/70 touch-action-manipulation"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {t('settings.generalSettings')}
            </h1>
          </div>

          {/* Settings List */}
          <div className="space-y-0">
            {/* Language Settings */}
            <Sheet open={languageSheetOpen} onOpenChange={setLanguageSheetOpen}>
              <SheetTrigger asChild>
                <button className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]">
                  <span className="text-sm md:text-base text-foreground">
                    {t('settings.language')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{currentLanguage?.flag}</span>
                    <span className="text-sm text-muted-foreground">
                      {currentLanguage?.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    {t('settings.language')}
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4 space-y-1 overflow-y-auto">
                  {languages.map((lang, index) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageSelect(lang.code)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 animate-fade-in ${
                        language === lang.code 
                          ? 'bg-primary/10 text-primary scale-[1.02]' 
                          : 'hover:bg-muted/50 active:bg-muted/70 hover:scale-[1.01]'
                      }`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="text-xl transition-transform duration-200 hover:scale-110">{lang.flag}</span>
                      <span className="text-sm md:text-base font-medium">{lang.name}</span>
                      {language === lang.code && (
                        <span className="ml-auto text-primary animate-scale-in">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Theme Mode */}
            <button
              onClick={handleThemeChange}
              className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]"
            >
              <span className="text-sm md:text-base text-foreground">
                {t('settings.themeMode')}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {themeLabel}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>

            {/* About Us */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]">
                  <span className="text-sm md:text-base text-foreground">
                    {t('settings.currencySettings')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>{t('settings.currencySettings')}</SheetTitle>
                </SheetHeader>
                <div className="py-4 overflow-y-auto space-y-4">
                  <div className="flex justify-center mb-2">
                    <img src={stEngineeringLogo} alt="ST Engineering Logo" className="h-10 object-contain" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('about.intro1')}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('about.intro2')}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('about.intro3')}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('about.intro4')}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('about.intro5')}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t('about.intro6')}
                  </p>
                  <p className="text-sm text-primary font-medium leading-relaxed">
                    {t('about.intro7')}
                  </p>
                  <Button 
                    onClick={() => navigate('/about')} 
                    className="w-full mt-2"
                  >
                    {t('about.learnMore')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Contact Info */}
            <button 
              onClick={() => navigate('/about')}
              className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]"
            >
              <span className="text-sm md:text-base text-foreground">
                {t('settings.about')}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
