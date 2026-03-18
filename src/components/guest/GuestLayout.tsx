import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { GuestHeader } from './GuestHeader';
import { GuestFooter } from './GuestFooter';


interface GuestLayoutProps {
  children: ReactNode;
  /**
   * When false, removes the top offset on mobile so content doesn't have empty space.
   * Desktop keeps the offset.
   */
  showHeaderOnMobile?: boolean;
}

export function GuestLayout({ children, showHeaderOnMobile = true }: GuestLayoutProps) {
  const location = useLocation();

  // Default behavior remains unchanged. This flag exists so we can later hide
  // the GuestHeader on mobile for specific routes and keep spacing in sync.
  const effectiveShowHeaderOnMobile =
    typeof showHeaderOnMobile === 'boolean' ? showHeaderOnMobile : location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
      <GuestHeader />
      <main className={effectiveShowHeaderOnMobile ? 'flex-1 pt-[104px]' : 'flex-1 pt-0 md:pt-[104px]'}>
        {children}
      </main>
      <GuestFooter />
      <MobileSupportButton />
    </div>
  );
}
