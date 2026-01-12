import { Link, useLocation } from 'react-router-dom';
import { Home, Newspaper, Package, Heart, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Trang nhất', href: '/', icon: Home },
  { label: 'Tin tức', href: '/news', icon: Newspaper },
  { label: 'Sản phẩm', href: '/products', icon: Package },
  { label: 'Từ thiện', href: '/charity', icon: Heart },
  { label: 'Của tôi', href: '/profile', icon: User },
];

export function BottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Gradient border top */}
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
                  'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-300',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'relative p-1.5 rounded-lg transition-all duration-300',
                  isActive && 'bg-primary/10'
                )}>
                  <item.icon className={cn(
                    'w-5 h-5 transition-all duration-300',
                    isActive && 'drop-shadow-[0_0_8px_hsl(var(--primary))]'
                  )} />
                  {isActive && (
                    <div className="absolute inset-0 rounded-lg animate-pulse bg-primary/5" />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium transition-all duration-300',
                  isActive && 'text-primary'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* Safe area for iOS */}
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  );
}
