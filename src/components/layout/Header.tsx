import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageCurrencySelector } from '@/components/settings/LanguageCurrencySelector';
import { SupportMenuButton } from '@/components/layout/SupportMenuButton';
import { 
  Home, 
  Newspaper, 
  Package, 
  Heart, 
  User, 
  Settings, 
  LogOut,
  Shield
} from 'lucide-react';
import stLogoWhite from '@/assets/st-logo-white-footer.png';

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  const navItems = [
    { label: t('nav.home'), href: '/', icon: Home },
    { label: t('nav.news'), href: '/news', icon: Newspaper },
    { label: t('nav.products'), href: '/products', icon: Package },
    { label: t('nav.charity'), href: '/charity', icon: Heart },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (email: string) => {
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <header
      className={
        isHome
          ? 'fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-transparent'
          : 'hidden md:block fixed top-0 left-0 right-0 z-50 glass border-b border-border/50'
      }
    >
      {isHome && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/80 via-background/35 to-transparent backdrop-blur-md"
        />
      )}
      <div className="container mx-auto px-4">
        <div className="relative flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src={stLogoWhite}
              alt="ST Engineering"
              className="h-7 sm:h-8 w-auto drop-shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
              loading="eager"
              decoding="async"
            />
          </Link>

          {/* Language/Currency Selector + User Menu */}
          <div className="flex items-center gap-2">
            <LanguageCurrencySelector showCurrency={false} />
            <SupportMenuButton />

            {/* Desktop: user menu/login */}
            <div className="hidden md:block">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10 border-2 border-primary/50">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-muted text-foreground">
                          {getInitials(user.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 glass" align="end">
                    <div className="flex items-center gap-2 p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-foreground text-xs">
                          {getInitials(user.email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.email}</span>
                        {isAdmin && (
                          <span className="text-xs text-primary flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                        <User className="w-4 h-4" />
                        {t('nav.profile')}
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                          <Settings className="w-4 h-4" />
                          {t('nav.dashboard')}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild className="bg-gradient-primary hover:opacity-90">
                  <Link to="/auth">{t('nav.login')}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
