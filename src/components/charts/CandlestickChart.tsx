import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
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
  onCandleUpdate?: (candle: OHLCData) => void;
}

export interface CandlestickChartRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  updateCandle: (candle: OHLCData) => void;
}

// Convert ISO time to UTC timestamp
const toTimestamp = (isoTime: string): UTCTimestamp => {
  return Math.floor(new Date(isoTime).getTime() / 1000) as UTCTimestamp;
};

// Deduplicate and sort OHLC data
const dedupeAndSortOHLC = (data: OHLCData[]): CandlestickData<UTCTimestamp>[] => {
  const timeMap = new Map<number, CandlestickData<UTCTimestamp>>();
  
  for (const d of data) {
    const time = toTimestamp(d.time);
    timeMap.set(time, {
      time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    });
  }
  
  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
};

// Deduplicate and sort indicator data
const dedupeAndSortIndicator = (indicatorData: { time: string; value: number }[]): LineData<UTCTimestamp>[] => {
  const timeMap = new Map<number, LineData<UTCTimestamp>>();
  
  for (const d of indicatorData) {
    const time = toTimestamp(d.time);
    timeMap.set(time, { time, value: d.value });
  }
  
  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
};

export const CandlestickChart = forwardRef<CandlestickChartRef, CandlestickChartProps>(
  ({ data, height = 280, indicatorConfig = defaultIndicatorConfig, onCandleUpdate }, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lastDataRef = useRef<string>('');
    
    // Calculate indicators
    const maData = useMemo(() => {
      if (!indicatorConfig.ma.enabled) return [];
      return calculateMA(data, indicatorConfig.ma.period);
    }, [data, indicatorConfig.ma.enabled, indicatorConfig.ma.period]);
    
    const emaData = useMemo(() => {
      if (!indicatorConfig.ema.enabled) return [];
      return calculateEMA(data, indicatorConfig.ema.period);
    }, [data, indicatorConfig.ema.enabled, indicatorConfig.ema.period]);

    const handleZoomIn = useCallback(() => {
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
    }, []);

    const handleZoomOut = useCallback(() => {
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
    }, []);

    const handleResetZoom = useCallback(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }, []);

    // Incremental update for single candle - much faster than setData()
    const updateCandle = useCallback((candle: OHLCData) => {
      if (!candleSeriesRef.current) return;
      
      const candleData: CandlestickData<UTCTimestamp> = {
        time: toTimestamp(candle.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      };
      
      // Use update() for incremental updates - much more efficient
      candleSeriesRef.current.update(candleData);
      onCandleUpdate?.(candle);
    }, [onCandleUpdate]);

    useImperativeHandle(ref, () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      resetZoom: handleResetZoom,
      updateCandle,
    }), [handleZoomIn, handleZoomOut, handleResetZoom, updateCandle]);

    // Initialize chart only once
    useEffect(() => {
      if (!chartContainerRef.current) return;

      // Create chart
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

      // Add candlestick series
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      // Responsive resize
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };
      
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        maSeriesRef.current = null;
        emaSeriesRef.current = null;
      };
    }, [height]);

    // Update data when it changes - use efficient comparison
    useEffect(() => {
      if (!candleSeriesRef.current || !chartRef.current || data.length === 0) return;

      // Create a simple hash to detect actual data changes
      const dataHash = data.length + '_' + (data[data.length - 1]?.time || '') + '_' + (data[data.length - 1]?.close || '');
      
      if (dataHash === lastDataRef.current) {
        return; // No actual changes
      }
      lastDataRef.current = dataHash;

      const formattedData = dedupeAndSortOHLC(data);
      candleSeriesRef.current.setData(formattedData);

      // Update MA series
      if (indicatorConfig.ma.enabled && maData.length > 0) {
        if (!maSeriesRef.current) {
          maSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: indicatorConfig.ma.color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
        }
        maSeriesRef.current.setData(dedupeAndSortIndicator(maData));
      } else if (maSeriesRef.current) {
        chartRef.current.removeSeries(maSeriesRef.current);
        maSeriesRef.current = null;
      }

      // Update EMA series
      if (indicatorConfig.ema.enabled && emaData.length > 0) {
        if (!emaSeriesRef.current) {
          emaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: indicatorConfig.ema.color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
          });
        }
        emaSeriesRef.current.setData(dedupeAndSortIndicator(emaData));
      } else if (emaSeriesRef.current) {
        chartRef.current.removeSeries(emaSeriesRef.current);
        emaSeriesRef.current = null;
      }

      chartRef.current.timeScale().fitContent();
    }, [data, indicatorConfig, maData, emaData]);

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

    return (
      <div className="relative">
        <div ref={chartContainerRef} />
      </div>
    );
  }
);

CandlestickChart.displayName = 'CandlestickChart';
