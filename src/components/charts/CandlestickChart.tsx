import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useState } from 'react';
import { createChart, IChartApi, CandlestickData, ColorType, CandlestickSeries, LineSeries, UTCTimestamp, LineData, ISeriesApi } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { IndicatorConfig, defaultIndicatorConfig } from './ChartIndicators';
import { calculateMA, calculateEMA } from '@/lib/indicators';

export interface OHLCData {
  time: string; // ISO date string that will be converted to UTC timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandlestickChartProps {
  data: OHLCData[];
  height?: number;
  indicatorConfig?: IndicatorConfig;
}

export interface CandlestickChartRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

// Track last candle for highlight detection
interface LastCandleInfo {
  time: string;
  close: number;
}

export const CandlestickChart = forwardRef<CandlestickChartRef, CandlestickChartProps>(
  ({ data, height = 280, indicatorConfig = defaultIndicatorConfig }, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const lastCandleRef = useRef<LastCandleInfo | null>(null);
    const [isHighlighting, setIsHighlighting] = useState(false);
    
    // Calculate indicators
    const maData = useMemo(() => {
      if (!indicatorConfig.ma.enabled) return [];
      return calculateMA(data, indicatorConfig.ma.period);
    }, [data, indicatorConfig.ma.enabled, indicatorConfig.ma.period]);
    
    const emaData = useMemo(() => {
      if (!indicatorConfig.ema.enabled) return [];
      return calculateEMA(data, indicatorConfig.ema.period);
    }, [data, indicatorConfig.ema.enabled, indicatorConfig.ema.period]);

    // Detect latest candle update and trigger highlight
    useEffect(() => {
      if (data.length === 0) return;
      
      const latestCandle = data[data.length - 1];
      const prevCandle = lastCandleRef.current;
      
      // Check if the latest candle has been updated
      if (prevCandle && (
        latestCandle.time !== prevCandle.time || 
        latestCandle.close !== prevCandle.close
      )) {
        setIsHighlighting(true);
        
        // Reset highlight after animation
        setTimeout(() => {
          setIsHighlighting(false);
        }, 600);
      }
      
      lastCandleRef.current = {
        time: latestCandle.time,
        close: latestCandle.close,
      };
    }, [data]);

    useImperativeHandle(ref, () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleResetZoom,
    }));

    const handleZoomIn = () => {
      if (chartRef.current) {
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleLogicalRange();
        if (visibleRange) {
          const rangeSize = visibleRange.to - visibleRange.from;
          const newRange = {
            from: visibleRange.from + rangeSize * 0.15,
            to: visibleRange.to - rangeSize * 0.15,
          };
          timeScale.setVisibleLogicalRange(newRange);
        }
      }
    };

    const handleZoomOut = () => {
      if (chartRef.current) {
        const timeScale = chartRef.current.timeScale();
        const visibleRange = timeScale.getVisibleLogicalRange();
        if (visibleRange) {
          const rangeSize = visibleRange.to - visibleRange.from;
          const newRange = {
            from: visibleRange.from - rangeSize * 0.25,
            to: visibleRange.to + rangeSize * 0.25,
          };
          timeScale.setVisibleLogicalRange(newRange);
        }
      }
    };

    const handleResetZoom = () => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    };

    useEffect(() => {
      if (!chartContainerRef.current || data.length === 0) return;

      // Clear previous chart
      chartContainerRef.current.innerHTML = '';

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'hsl(var(--muted-foreground))',
        },
        grid: {
          vertLines: { color: 'rgba(197, 203, 206, 0.1)' },
          horzLines: { color: 'rgba(197, 203, 206, 0.1)' },
        },
        width: chartContainerRef.current.clientWidth,
        height: height,
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: 'rgba(197, 203, 206, 0.2)',
        },
        rightPriceScale: {
          borderColor: 'rgba(197, 203, 206, 0.2)',
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: 'rgba(224, 227, 235, 0.4)',
            labelBackgroundColor: 'hsl(var(--primary))',
          },
          horzLine: {
            width: 1,
            color: 'rgba(224, 227, 235, 0.4)',
            labelBackgroundColor: 'hsl(var(--primary))',
          },
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      // Convert data to proper format - use Unix timestamp (seconds)
      const formattedData: CandlestickData<UTCTimestamp>[] = data.map((d) => ({
        time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      candleSeries.setData(formattedData);
      
      // Add MA line if enabled
      if (indicatorConfig.ma.enabled && maData.length > 0) {
        const maSeries = chart.addSeries(LineSeries, {
          color: indicatorConfig.ma.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const maFormatted: LineData<UTCTimestamp>[] = maData.map((d) => ({
          time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp,
          value: d.value,
        }));
        maSeries.setData(maFormatted);
      }
      
      // Add EMA line if enabled
      if (indicatorConfig.ema.enabled && emaData.length > 0) {
        const emaSeries = chart.addSeries(LineSeries, {
          color: indicatorConfig.ema.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const emaFormatted: LineData<UTCTimestamp>[] = emaData.map((d) => ({
          time: Math.floor(new Date(d.time).getTime() / 1000) as UTCTimestamp,
          value: d.value,
        }));
        emaSeries.setData(emaFormatted);
      }
      
      chart.timeScale().fitContent();
      chartRef.current = chart;

      // Responsive resize
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
      };
    }, [data, height, indicatorConfig, maData, emaData]);

    if (data.length === 0) {
      return (
        <div 
          className="flex items-center justify-center text-muted-foreground"
          style={{ height }}
        >
          Đang tải dữ liệu biểu đồ...
        </div>
      );
    }

    // Determine if latest candle is up or down for highlight color
    const latestIsUp = data.length > 0 && data[data.length - 1].close >= data[data.length - 1].open;

    return (
      <div className="relative">
        {/* Highlight overlay when price updates */}
        {isHighlighting && (
          <div 
            className="absolute inset-0 pointer-events-none z-20 animate-pulse"
            style={{
              background: latestIsUp 
                ? 'linear-gradient(90deg, transparent 85%, rgba(34, 197, 94, 0.15) 100%)'
                : 'linear-gradient(90deg, transparent 85%, rgba(239, 68, 68, 0.15) 100%)',
            }}
          />
        )}
        
        {/* Update indicator badge */}
        {isHighlighting && (
          <div 
            className={`absolute top-2 left-2 z-20 px-2 py-0.5 rounded text-xs font-medium animate-fade-in ${
              latestIsUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            ● LIVE
          </div>
        )}
        
        {/* Zoom Controls */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 bg-background/80 backdrop-blur"
            onClick={handleZoomIn}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 bg-background/80 backdrop-blur"
            onClick={handleZoomOut}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7 bg-background/80 backdrop-blur"
            onClick={handleResetZoom}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div ref={chartContainerRef} />
      </div>
    );
  }
);

CandlestickChart.displayName = 'CandlestickChart';
