import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import stLogoWhite from '@/assets/st-logo-white-footer.png';
import stEngineeringLogo from '@/assets/st-engineering-logo.png';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Menu, ChevronRight, MapPin, Mail, Phone, Globe, MessageCircle, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLiveChat } from '@/contexts/LiveChatContext';

export function GuestHeader() {
  const { t, language, setLanguage } = useLanguage();
  const { openChat } = useLiveChat();
  const [contactOpen, setContactOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const languages = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
  ] as const;

  const supportEmail = 'stengg.com@stengg.it.com';
  const supportPhone = '+65 6722 1234';
  const website = 'https://stengg.it.com';

  const handleLiveChatClick = () => {
    setContactOpen(false);
    openChat();
  };

  const menuItems = [
    { label: t('guest.aboutUs'), href: '#' },
    { label: t('guest.ourBusinesses'), href: '#' },
    { label: t('guest.investorRelations'), href: '#' },
    { label: t('guest.sustainability'), href: '#' },
    { label: t('guest.newsroom'), href: '#' },
    { label: t('guest.careers'), href: '#' },
  ];

  return (
    <>
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
              <Popover open={langOpen} onOpenChange={setLangOpen}>
                <PopoverTrigger asChild>
                  <button className="hover:text-foreground cursor-pointer bg-transparent border-none p-0 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {t('guest.global')}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                        language === lang.code 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted/50 text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                      </span>
                      {language === lang.code && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
              <button 
                onClick={() => setContactOpen(true)} 
                className="hover:text-foreground cursor-pointer bg-transparent border-none p-0"
              >
                {t('guest.contact')}
              </button>
              <button 
                onClick={openChat} 
                className="hover:text-foreground cursor-pointer bg-transparent border-none p-0"
              >
                {t('guest.support')}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="hover:text-foreground">{t('nav.login')}</Link>
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
                      <div className="space-y-1">
                        {languages.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => setLanguage(lang.code)}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                              language === lang.code 
                                ? 'bg-primary/10 text-primary' 
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span>{lang.flag}</span>
                              <span>{lang.label}</span>
                            </span>
                            {language === lang.code && (
                              <Check className="w-4 h-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
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

      {/* Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border p-0 gap-0">
          {/* Header with logo */}
          <div className="p-6 pb-4 text-center border-b border-border/30">
            <img 
              src={stEngineeringLogo} 
              alt="ST Engineering" 
              className="h-10 mx-auto mb-4 object-contain" 
            />
            <p className="text-sm text-muted-foreground">
              {t('about.portalDescription')}
            </p>
          </div>

          {/* Contact Support Section */}
          <Card className="border-0 rounded-none shadow-none">
            <CardContent className="p-0">
              <h3 className="text-sm font-medium text-foreground px-4 py-3 border-b border-border/30 text-center">
                {t('about.contactSupport')}
              </h3>
              
              {/* Address */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{t('about.address')}</span>
                </div>
                <span className="text-sm text-muted-foreground">ST Engineering Hub, Singapore</span>
              </div>

              {/* Email */}
              <a 
                href={`mailto:${supportEmail}`} 
                className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">Email</span>
                </div>
                <span className="text-sm text-muted-foreground">{supportEmail}</span>
              </a>

              {/* Phone */}
              <a 
                href={`tel:${supportPhone.replace(/\s/g, '')}`} 
                className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{t('about.phone')}</span>
                </div>
                <span className="text-sm text-muted-foreground">{supportPhone}</span>
              </a>

              {/* Website */}
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">Website</span>
                </div>
                <span className="text-sm text-muted-foreground">{website.replace('https://', '')}</span>
              </a>

              {/* Live Chat */}
              <button 
                onClick={handleLiveChatClick}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left bg-transparent border-none cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{t('about.liveChat')}</span>
                </div>
                <span className="text-sm text-muted-foreground">{t('about.chatNow')}</span>
              </button>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}