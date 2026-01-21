import { ReactNode } from 'react';
import { GuestHeader } from './GuestHeader';
import { GuestFooter } from './GuestFooter';
import { LiveChatButton } from '@/components/layout/LiveChatButton';

interface GuestLayoutProps {
  children: ReactNode;
}

export function GuestLayout({ children }: GuestLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e1a]">
      <GuestHeader />
      <main className="flex-1 pt-[104px]">
        {children}
      </main>
      <GuestFooter />
      <LiveChatButton />
    </div>
  );
}
