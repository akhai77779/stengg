import { forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Newspaper, Package, Heart, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export const BottomNavigation = forwardRef<HTMLElement, object>(function BottomNavigation(_, ref) {
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { label: t('nav.home'), href: '/', icon: Home },
    { label: t('nav.news'), href: '/news', icon: Newspaper },
    { label: t('nav.products'), href: '/products', icon: Package },
    { label: t('nav.charity'), href: '/charity', icon: Heart },
    { label: t('nav.profile'), href: '/profile', icon: User },
  ];

  return (
    <nav ref={ref} className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-inset-bottom">
      <div className="h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      
      <div className="bg-card/95 backdrop-blur-xl border-t border-border/50">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full min-h-[56px] gap-1 transition-all duration-200 touch-target no-select',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground active:text-foreground'
                )}
              >
                <div className={cn(
                  'relative p-2 rounded-xl transition-all duration-200',
                  isActive && 'bg-primary/10'
                )}>
                  <item.icon className={cn(
                    'w-5 h-5 transition-all duration-200',
                    isActive && 'drop-shadow-[0_0_8px_hsl(var(--primary))]'
                  )} />
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl animate-pulse bg-primary/5" />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium transition-all duration-200',
                  isActive && 'text-primary'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
});
