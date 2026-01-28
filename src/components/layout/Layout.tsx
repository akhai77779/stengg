import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNavigation } from './BottomNavigation';
import { NetworkStatus } from './NetworkStatus';
import { ChatWidget } from '@/components/live-chat';

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
  hideChatWidget?: boolean;
}

export function Layout({ children, hideFooter = false, hideChatWidget = false }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isProductDetail = location.pathname.startsWith('/products/') && location.pathname !== '/products';
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Network status banner */}
      <NetworkStatus />
      
      <Header />
      <main className={isHome ? 'flex-1 pt-16 pb-16 md:pb-0' : isProductDetail ? 'flex-1 pt-2 pb-16 md:pb-0' : 'flex-1 pt-0 md:pt-16 pb-16 md:pb-0'}>
        {children}
      </main>
      {!hideFooter && <Footer />}
      <BottomNavigation />
      
      {/* Live Chat Widget - hide on admin pages */}
      {!hideChatWidget && !isAdminPage && <ChatWidget />}
    </div>
  );
}
