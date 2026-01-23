import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface MiniPriceChartProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
}

export const MiniPriceChart = ({
  data,
  width = 60,
  height = 24,
  className,
  strokeWidth = 1.5,
}: MiniPriceChartProps) => {
  const { path, isPositive, fillPath } = useMemo(() => {
    if (data.length < 2) {
      return { path: '', isPositive: true, fillPath: '' };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = padding + (1 - (value - min) / range) * (height - padding * 2);
      return { x, y };
    });

    // Create SVG path
    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');

    // Create fill path (area under the line)
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height} L ${points[0].x.toFixed(2)} ${height} Z`;

    // Determine trend
    const positive = data[data.length - 1] >= data[0];

    return { path: linePath, isPositive: positive, fillPath: areaPath };
  }, [data, width, height]);

  if (data.length < 2) {
    return null;
  }

  const strokeColor = isPositive ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(0 84.2% 60.2%)';
  const fillColor = isPositive ? 'hsl(142.1 76.2% 36.3% / 0.15)' : 'hsl(0 84.2% 60.2% / 0.15)';

  return (
    <svg
      width={width}
      height={height}
      className={cn('flex-shrink-0', className)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Gradient fill under the line */}
      <defs>
        <linearGradient id={`gradient-${isPositive ? 'up' : 'down'}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={fillPath}
        fill={`url(#gradient-${isPositive ? 'up' : 'down'})`}
      />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
