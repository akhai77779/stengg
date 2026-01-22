import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNavigation } from './BottomNavigation';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className={isHome ? 'flex-1 pt-16 pb-16 md:pb-0' : 'flex-1 pt-0 md:pt-16 pb-16 md:pb-0'}>
        {children}
      </main>
      <Footer />
      <BottomNavigation />
    </div>
  );
}
