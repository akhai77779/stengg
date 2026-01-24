import { useState, useEffect, useMemo, useCallback } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandleCountdownProps {
  timeframe: '1m' | '30m' | '1h' | '1d';
  lastCandleTime?: string;
  onCandleClose?: () => void;
}

// Get interval in milliseconds for each timeframe
const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export const CandleCountdown = ({ timeframe, lastCandleTime, onCandleClose }: CandleCountdownProps) => {
  const [countdown, setCountdown] = useState(0);
  const [prevCountdown, setPrevCountdown] = useState(0);
  
  const intervalMs = TIMEFRAME_MS[timeframe] || 60000;
  const intervalSec = intervalMs / 1000;

  const updateCountdown = useCallback(() => {
    const now = Date.now();
    const currentPeriod = Math.floor(now / intervalMs);
    const nextPeriodStart = (currentPeriod + 1) * intervalMs;
    const remainingMs = nextPeriodStart - now;
    const remainingSec = Math.ceil(remainingMs / 1000);
    
    return remainingSec;
  }, [intervalMs]);

  useEffect(() => {
    const tick = () => {
      const newCountdown = updateCountdown();
      
      // Detect candle close (countdown reset to full interval)
      if (prevCountdown > 0 && prevCountdown <= 1 && newCountdown >= intervalSec - 1) {
        onCandleClose?.();
      }
      
      setPrevCountdown(countdown);
      setCountdown(newCountdown);
    };

    tick();
    const timer = setInterval(tick, 1000);
    
    return () => clearInterval(timer);
  }, [intervalMs, lastCandleTime, updateCountdown, onCandleClose, countdown, prevCountdown, intervalSec]);

  const formatTime = useCallback((seconds: number) => {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  // Calculate progress percentage (how much of the candle period has passed)
  const progress = useMemo(() => {
    return ((intervalSec - countdown) / intervalSec) * 100;
  }, [countdown, intervalSec]);

  // Determine urgency level
  const urgencyLevel = useMemo(() => {
    const percentRemaining = (countdown / intervalSec) * 100;
    
    if (percentRemaining <= 5) return 'critical';
    if (percentRemaining <= 15) return 'warning';
    if (percentRemaining <= 30) return 'attention';
    return 'normal';
  }, [countdown, intervalSec]);

  // Urgency styling
  const urgencyStyles = {
    critical: {
      text: 'text-red-500',
      bg: 'bg-red-500',
      icon: true,
      pulse: true,
    },
    warning: {
      text: 'text-orange-500',
      bg: 'bg-orange-500',
      icon: false,
      pulse: true,
    },
    attention: {
      text: 'text-yellow-500',
      bg: 'bg-yellow-500',
      icon: false,
      pulse: false,
    },
    normal: {
      text: 'text-muted-foreground',
      bg: 'bg-primary',
      icon: false,
      pulse: false,
    },
  };

  const style = urgencyStyles[urgencyLevel];

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        {style.icon ? (
          <AlertCircle className={cn("h-3 w-3", style.text, style.pulse && "animate-pulse")} />
        ) : (
          <Clock className={cn("h-3 w-3", style.text, style.pulse && "animate-pulse")} />
        )}
        <span className={cn(
          "font-mono font-medium tabular-nums",
          style.text,
          urgencyLevel === 'critical' && "animate-pulse"
        )}>
          {formatTime(countdown)}
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="relative w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-1000 ease-linear",
            style.bg
          )}
          style={{ width: `${progress}%` }}
        />
        {/* Glow effect when critical */}
        {urgencyLevel === 'critical' && (
          <div 
            className="absolute right-0 top-0 h-full w-2 bg-red-500/50 animate-pulse rounded-full"
          />
        )}
      </div>

      {/* Timeframe label */}
      <span className="text-[10px] text-muted-foreground uppercase">
        {timeframe}
      </span>
    </div>
  );
};
