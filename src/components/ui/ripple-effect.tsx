import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';

interface RippleProps {
  x: number;
  y: number;
  size: number;
}

interface RippleEffectProps {
  children: React.ReactNode;
  className?: string;
  rippleColor?: string;
  disabled?: boolean;
  as?: 'div' | 'button' | 'span';
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
}

export function RippleEffect({
  children,
  className,
  rippleColor = 'rgba(255, 255, 255, 0.3)',
  disabled = false,
  as: Component = 'div',
  onClick,
  ...props
}: RippleEffectProps & React.HTMLAttributes<HTMLElement>) {
  const [ripples, setRipples] = useState<RippleProps[]>([]);
  const containerRef = useRef<HTMLElement>(null);

  const addRipple = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const newRipple = { x, y, size };
    setRipples((prev) => [...prev, newRipple]);

    // Remove ripple after animation completes
    setTimeout(() => {
      setRipples((prev) => prev.slice(1));
    }, 600);
  }, [disabled]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    addRipple(e);
    onClick?.(e);
  }, [addRipple, onClick]);

  return (
    <Component
      ref={containerRef as any}
      className={cn('relative overflow-hidden', className)}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((ripple, index) => (
        <span
          key={index}
          className="absolute rounded-full animate-ripple pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: rippleColor,
          }}
        />
      ))}
    </Component>
  );
}

// HOC for wrapping existing components with ripple effect
export function withRipple<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  rippleColor?: string
) {
  return function RippleWrapper(props: T & { className?: string }) {
    return (
      <RippleEffect rippleColor={rippleColor} className="inline-block">
        <WrappedComponent {...props} />
      </RippleEffect>
    );
  };
}
