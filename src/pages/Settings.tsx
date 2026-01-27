import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChevronLeft, ChevronRight, ArrowUpDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Settings() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { currency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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

            {/* Currency Settings */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]">
                  <span className="text-sm md:text-base text-foreground">
                    {t('settings.currencySettings')}
                  </span>
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-green-500" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>{t('settings.currencySettings')}</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('settings.currentCurrency')}: <span className="font-medium text-foreground">{currency}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.currencyNote')}
                  </p>
                </div>
              </SheetContent>
            </Sheet>

            {/* About */}
            <button 
              onClick={() => {}}
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
