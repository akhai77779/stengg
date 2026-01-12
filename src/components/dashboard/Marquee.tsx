import { Bell } from 'lucide-react';

interface MarqueeProps {
  message: string;
}

export function Marquee({ message }: MarqueeProps) {
  return (
    <div className="relative overflow-hidden bg-card/80 backdrop-blur-sm border border-border/50 rounded-lg">
      {/* Animated border effect */}
      <div className="absolute inset-0 rounded-lg">
        <div 
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)',
            animation: 'shimmer 3s infinite linear',
          }}
        />
      </div>
      
      <div className="relative flex items-center gap-3 px-4 py-3">
        <div className="flex-shrink-0 p-1.5 rounded-lg bg-primary/20">
          <Bell className="w-4 h-4 text-primary animate-pulse" />
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div 
            className="whitespace-nowrap text-sm text-foreground"
            style={{
              animation: 'marquee 20s linear infinite',
            }}
          >
            {message}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
