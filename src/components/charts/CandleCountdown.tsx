import { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';

interface CandleCountdownProps {
  timeframe: '1m' | '30m' | '1h' | '1d';
  lastCandleTime?: string;
}

// Get interval in milliseconds for each timeframe
const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

export const CandleCountdown = ({ timeframe, lastCandleTime }: CandleCountdownProps) => {
  const [countdown, setCountdown] = useState(0);
  const [isActive, setIsActive] = useState(false);
  
  const intervalMs = TIMEFRAME_MS[timeframe] || 60000;

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      // Calculate time until next candle closes
      // For 1m: next candle closes at the start of the next minute
      const intervalSec = intervalMs / 1000;
      const currentPeriod = Math.floor(now / intervalMs);
      const nextPeriodStart = (currentPeriod + 1) * intervalMs;
      const remainingMs = nextPeriodStart - now;
      const remainingSec = Math.ceil(remainingMs / 1000);
      
      setCountdown(remainingSec);
      setIsActive(remainingSec <= intervalSec);
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(timer);
  }, [intervalMs, lastCandleTime]);

  const formatTime = (seconds: number) => {
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage (how much of the candle period has passed)
  const progress = useMemo(() => {
    const totalSec = intervalMs / 1000;
    return ((totalSec - countdown) / totalSec) * 100;
  }, [countdown, intervalMs]);

  // Determine urgency color
  const urgencyColor = useMemo(() => {
    const totalSec = intervalMs / 1000;
    const percentRemaining = (countdown / totalSec) * 100;
    
    if (percentRemaining <= 10) return 'text-red-500';
    if (percentRemaining <= 25) return 'text-yellow-500';
    return 'text-muted-foreground';
  }, [countdown, intervalMs]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        <Clock className={`h-3 w-3 ${urgencyColor} ${countdown <= 5 ? 'animate-pulse' : ''}`} />
        <span className={`font-mono font-medium ${urgencyColor}`}>
          {formatTime(countdown)}
        </span>
      </div>
      
      {/* Mini progress bar */}
      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
