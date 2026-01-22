import { Link } from 'react-router-dom';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import stLogoWhite from '@/assets/st-logo-white-footer.png';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Menu, ChevronRight } from 'lucide-react';

export function GuestHeader() {
  const { language, setLanguage, t } = useLanguage();

  const menuItems = [
    { label: t('guest.aboutUs'), href: '#' },
    { label: t('guest.ourBusinesses'), href: '#' },
    { label: t('guest.investorRelations'), href: '#' },
    { label: t('guest.sustainability'), href: '#' },
    { label: t('guest.newsroom'), href: '#' },
    { label: t('guest.careers'), href: '#' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-transparent">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/80 via-background/35 to-transparent backdrop-blur-md"
      />
      {/* Top bar */}
      <div className="relative border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground">{t('guest.global')}</a>
              <a href="#" className="hover:text-foreground">{t('guest.contact')}</a>
              <a href="#" className="hover:text-foreground">{t('guest.support')}</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="hover:text-foreground">{t('nav.login')}</Link>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-background/40 border border-border text-foreground/90 text-[11px] rounded px-2 py-0.5"
              >
                <option value="vi" className="bg-background">🇻🇳 Tiếng Việt</option>
                <option value="en" className="bg-background">🇬🇧 English</option>
                <option value="zh" className="bg-background">🇨🇳 中文</option>
                <option value="th" className="bg-background">🇹🇭 ไทย</option>
                <option value="ja" className="bg-background">🇯🇵 日本語</option>
                <option value="ko" className="bg-background">🇰🇷 한국어</option>
                <option value="id" className="bg-background">🇮🇩 Bahasa Indonesia</option>
                <option value="ms" className="bg-background">🇲🇾 Bahasa Melayu</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main navigation */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 text-foreground text-xl font-light">
            <img
              src={stLogoWhite}
              alt="ST Engineering"
              className="h-7 w-auto drop-shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
              loading="eager"
              decoding="async"
            />
          </Link>

          {/* Mobile hamburger */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="glass border border-border/40"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="glass">
                <SheetHeader>
                  <SheetTitle className="text-left">{t('guest.global')}</SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <div className="space-y-1">
                    {menuItems.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/90 hover:bg-muted/40"
                      >
                        <span>{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <Button asChild className="w-full bg-gradient-primary hover:opacity-90">
                      <Link to="/login">{t('nav.login')}</Link>
                    </Button>

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">{t('guest.global')}</div>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as Language)}
                        className="w-full bg-background/40 border border-border text-foreground/90 text-sm rounded-md px-3 py-2"
                      >
                        <option value="vi" className="bg-background">🇻🇳 Tiếng Việt</option>
                        <option value="en" className="bg-background">🇬🇧 English</option>
                        <option value="zh" className="bg-background">🇨🇳 中文</option>
                        <option value="th" className="bg-background">🇹🇭 ไทย</option>
                        <option value="ja" className="bg-background">🇯🇵 日本語</option>
                        <option value="ko" className="bg-background">🇰🇷 한국어</option>
                        <option value="id" className="bg-background">🇮🇩 Bahasa Indonesia</option>
                        <option value="ms" className="bg-background">🇲🇾 Bahasa Melayu</option>
                      </select>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <nav className="hidden lg:flex items-center space-x-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">{t('guest.aboutUs')}</a>
            <a href="#" className="hover:text-foreground">{t('guest.ourBusinesses')}</a>
            <a href="#" className="hover:text-foreground">{t('guest.investorRelations')}</a>
            <a href="#" className="hover:text-foreground">{t('guest.sustainability')}</a>
            <a href="#" className="hover:text-foreground">{t('guest.newsroom')}</a>
            <a href="#" className="hover:text-foreground">{t('guest.careers')}</a>
          </nav>
        </div>
      </div>
    </header>
  );
}