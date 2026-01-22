import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNavigation } from './BottomNavigation';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-16 pb-16 md:pb-0">
        {children}
      </main>
      <Footer />
      <BottomNavigation />
    </div>
  );
}
