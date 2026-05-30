import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import { createChart, IChartApi, CandlestickData, ColorType, CandlestickSeries, LineSeries, UTCTimestamp, LineData, ISeriesApi, LogicalRange } from 'lightweight-charts';
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
  /**
   * When this string changes, the chart resets zoom (fitContent). Otherwise the user's
   * current pan/zoom is preserved across data updates.
   */
  resetZoomKey?: string;
  /** Persist the user's visible range across route changes and page reloads. */
  visibleRangeKey?: string;
}

export interface CandlestickChartRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  updateCandle: (candle: OHLCData) => void;
}

/**
 * Pure helper computing the next visible logical range for the time scale.
 * - `reset` mode snaps to the last `resetWindow` candles (used on first mount / product switch).
 * - `preserve` mode clamps the user's previous range into the new dataset bounds,
 *   keeping the original width so timeframe switches / new candles don't jump.
 */
export function computeNextVisibleRange(
  prevRange: { from: number; to: number } | null,
  newTotal: number,
  mode: 'reset' | 'preserve',
  resetWindow = 60,
): { from: number; to: number } | null {
  if (mode === 'reset') {
    if (newTotal <= 0) return null;
    const visible = Math.min(resetWindow, newTotal);
    return { from: Math.max(0, newTotal - visible), to: newTotal + 2 };
  }
  if (!prevRange) return null;
  const width = prevRange.to - prevRange.from;
  const to = Math.min(prevRange.to, newTotal + 2);
  const from = Math.max(0, to - width);
  return { from, to };
}

const VISIBLE_RANGE_STORAGE_PREFIX = 'stengg:chart-visible-range:v1:';

function getSessionStorage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' && globalThis.sessionStorage ? globalThis.sessionStorage : null;
  } catch {
    return null;
  }
}

export function chartVisibleRangeStorageKey(key: string) {
  return `${VISIBLE_RANGE_STORAGE_PREFIX}${key}`;
}

function isValidVisibleRange(range: unknown): range is LogicalRange {
  if (!range || typeof range !== 'object') return false;
  const value = range as { from?: unknown; to?: unknown };
  return typeof value.from === 'number' && typeof value.to === 'number' && Number.isFinite(value.from) && Number.isFinite(value.to) && value.to > value.from;
}

export function readStoredVisibleRange(key: string | undefined, newTotal: number): LogicalRange | null {
  const storage = getSessionStorage();
  if (!key || !storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(chartVisibleRangeStorageKey(key)) || 'null');
    if (!isValidVisibleRange(parsed)) return null;
    return computeNextVisibleRange(parsed, newTotal, 'preserve') as LogicalRange | null;
  } catch {
    storage.removeItem(chartVisibleRangeStorageKey(key));
    return null;
  }
}

export function writeStoredVisibleRange(key: string | undefined, range: LogicalRange | null) {
  const storage = getSessionStorage();
  if (!key || !storage || !isValidVisibleRange(range)) return;
  try {
    storage.setItem(chartVisibleRangeStorageKey(key), JSON.stringify({ from: range.from, to: range.to }));
  } catch {
    storage.removeItem(chartVisibleRangeStorageKey(key));
  }
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
  ({ data, height = 280, indicatorConfig = defaultIndicatorConfig, onCandleUpdate, resetZoomKey, visibleRangeKey }, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const maSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lastDataRef = useRef<string>('');
    const lastResetKeyRef = useRef<string | undefined>(undefined);
    const hasInitialDataRef = useRef<boolean>(false);
    const visibleRangeKeyRef = useRef<string | undefined>(visibleRangeKey);

    useEffect(() => {
      visibleRangeKeyRef.current = visibleRangeKey;
    }, [visibleRangeKey]);
    
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

      const handleVisibleRangeChange = (range: LogicalRange | null) => {
        writeStoredVisibleRange(visibleRangeKeyRef.current, range);
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
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
      const prevHash = lastDataRef.current;
      lastDataRef.current = dataHash;

      const formattedData = dedupeAndSortOHLC(data);
      const resetChanged = resetZoomKey !== lastResetKeyRef.current;
      const isFirstLoad = !hasInitialDataRef.current;
      const sameLength = prevHash && Number(prevHash.split('_')[0]) === data.length;

      const ts = chartRef.current.timeScale();
      const shouldResetView = isFirstLoad || resetChanged;

      if (shouldResetView) {
        // First mount or product switch: restore the saved view if available,
        // otherwise snap to the last ~60 candles.
        candleSeriesRef.current.setData(formattedData);
        const next = readStoredVisibleRange(visibleRangeKey, formattedData.length)
          ?? computeNextVisibleRange(null, formattedData.length, 'reset');
        if (next) ts.setVisibleLogicalRange(next);
        hasInitialDataRef.current = true;
        lastResetKeyRef.current = resetZoomKey;
      } else if (sameLength) {
        // Same dataset shape, last candle likely changed — incremental update.
        const last = formattedData[formattedData.length - 1];
        if (last) {
          try {
            candleSeriesRef.current.update(last);
          } catch {
            const prevRange = ts.getVisibleLogicalRange();
            candleSeriesRef.current.setData(formattedData);
            if (prevRange) ts.setVisibleLogicalRange(prevRange);
          }
        }
      } else {
        // Length changed (timeframe switch re-aggregated, or new candle appended).
        // Preserve the user's current visible range across setData to avoid jumps.
        const prevRange = ts.getVisibleLogicalRange();
        candleSeriesRef.current.setData(formattedData);
        const next = computeNextVisibleRange(prevRange, formattedData.length, 'preserve');
        if (next) ts.setVisibleLogicalRange(next);
      }

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
    }, [data, indicatorConfig, maData, emaData, resetZoomKey]);

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
