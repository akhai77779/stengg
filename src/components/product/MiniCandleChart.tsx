import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MiniCandleChartProps {
  data: CandleData[];
  width?: number;
  height?: number;
  className?: string;
}

export function MiniCandleChart({ data, width = 120, height = 56, className }: MiniCandleChartProps) {
  const { candles, isPositive } = useMemo(() => {
    if (!data || data.length < 2) return { candles: [], isPositive: true };

    const allPrices = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const range = max - min || 1;
    const padX = 2;
    const padY = 3;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const candleW = Math.max(1, Math.floor(innerW / data.length) - 1);
    const halfW = Math.max(0.5, candleW / 2 - 0.5);

    const toY = (price: number) => padY + innerH * (1 - (price - min) / range);

    const candles = data.map((d, i) => {
      const x = padX + (i / (data.length - 1)) * innerW;
      const isUp = d.close >= d.open;
      const bodyTop = toY(Math.max(d.open, d.close));
      const bodyBot = toY(Math.min(d.open, d.close));
      const wickTop = toY(d.high);
      const wickBot = toY(d.low);
      const bodyH = Math.max(1, bodyBot - bodyTop);
      return { x, bodyTop, bodyBot, bodyH, wickTop, wickBot, isUp, halfW };
    });

    const isPositive = (data[data.length - 1]?.close ?? 0) >= (data[0]?.close ?? 0);
    return { candles, isPositive };
  }, [data, width, height]);

  if (!data || data.length < 2) return null;

  const upColor = '#22c55e';
  const downColor = '#ef4444';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
    >
      {candles.map((c, i) => (
        <g key={i}>
          {/* Wick */}
          <line
            x1={c.x}
            y1={c.wickTop}
            x2={c.x}
            y2={c.wickBot}
            stroke={c.isUp ? upColor : downColor}
            strokeWidth={0.8}
            opacity={0.8}
          />
          {/* Body */}
          <rect
            x={c.x - c.halfW}
            y={c.bodyTop}
            width={c.halfW * 2}
            height={c.bodyH}
            fill={c.isUp ? upColor : downColor}
            opacity={0.9}
            rx={0.5}
          />
        </g>
      ))}
      {/* Trend overlay line */}
      <defs>
        <linearGradient id={`cg-${isPositive ? 'up' : 'dn'}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={isPositive ? upColor : downColor} stopOpacity="0" />
          <stop offset="100%" stopColor={isPositive ? upColor : downColor} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill={`url(#cg-${isPositive ? 'up' : 'dn'})`} />
    </svg>
  );
}
