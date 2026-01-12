import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedBorderCardProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedBorderCard({ children, className }: AnimatedBorderCardProps) {
  return (
    <div className={cn('relative group', className)}>
      {/* Animated border gradient */}
      <div 
        className="absolute -inset-[1px] rounded-xl opacity-75 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
          backgroundSize: '200% 100%',
          animation: 'borderGlow 3s linear infinite',
        }}
      />
      
      {/* Inner content */}
      <div className="relative bg-card rounded-xl">
        {children}
      </div>
      
      <style>{`
        @keyframes borderGlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
