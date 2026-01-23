import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedPriceProps {
  value: number | null;
  formatter: (value: number | null) => string;
  className?: string;
}

type PriceState = 'neutral' | 'up' | 'down';

export function AnimatedPrice({ value, formatter, className }: AnimatedPriceProps) {
  const [priceState, setPriceState] = useState<PriceState>('neutral');
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === null || prevValueRef.current === null) {
      prevValueRef.current = value;
      return;
    }

    if (value > prevValueRef.current) {
      setPriceState('up');
      setIsFlashing(true);
    } else if (value < prevValueRef.current) {
      setPriceState('down');
      setIsFlashing(true);
    }

    prevValueRef.current = value;

    // Flash animation duration
    const flashTimer = setTimeout(() => {
      setIsFlashing(false);
    }, 600);

    // Reset to neutral after animation
    const resetTimer = setTimeout(() => {
      setPriceState('neutral');
    }, 1500);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(resetTimer);
    };
  }, [value]);

  return (
    <span
      className={cn(
        'transition-colors duration-200',
        priceState === 'neutral' && 'text-foreground',
        priceState === 'up' && 'text-green-500',
        priceState === 'down' && 'text-red-500',
        isFlashing && 'animate-price-flash',
        className
      )}
    >
      {formatter(value)}
    </span>
  );
}

interface AnimatedStatProps {
  value: string | number | null;
  prevValue?: string | number | null;
  className?: string;
  alwaysCyan?: boolean;
}

export function AnimatedStat({ value, prevValue, className, alwaysCyan = false }: AnimatedStatProps) {
  const [priceState, setPriceState] = useState<PriceState>('neutral');
  const [isFlashing, setIsFlashing] = useState(false);
  const prevValueRef = useRef<string | number | null>(null);

  useEffect(() => {
    const currentNum = typeof value === 'string' ? parseFloat(value) : value;
    const prevNum = typeof prevValueRef.current === 'string' ? parseFloat(prevValueRef.current) : prevValueRef.current;

    if (currentNum === null || prevNum === null || isNaN(currentNum) || isNaN(prevNum)) {
      prevValueRef.current = value;
      return;
    }

    if (currentNum > prevNum) {
      setPriceState('up');
      setIsFlashing(true);
    } else if (currentNum < prevNum) {
      setPriceState('down');
      setIsFlashing(true);
    }

    prevValueRef.current = value;

    const flashTimer = setTimeout(() => {
      setIsFlashing(false);
    }, 600);

    const resetTimer = setTimeout(() => {
      setPriceState('neutral');
    }, 1500);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(resetTimer);
    };
  }, [value]);

  if (alwaysCyan) {
    return (
      <span
        className={cn(
          'transition-colors duration-200 text-cyan-400',
          isFlashing && 'animate-price-flash',
          className
        )}
      >
        {value ?? '--'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'transition-colors duration-200',
        priceState === 'neutral' && 'text-foreground',
        priceState === 'up' && 'text-green-500',
        priceState === 'down' && 'text-red-500',
        isFlashing && 'animate-price-flash',
        className
      )}
    >
      {value ?? '--'}
    </span>
  );
}
