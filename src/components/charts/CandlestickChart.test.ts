import { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useCallback } from "react";
import {
  createChart,
  IChartApi,
  CandlestickData,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  UTCTimestamp,
  LineData,
  ISeriesApi,
  HistogramData,
  CrosshairMode,
} from "lightweight-charts";
import { IndicatorConfig, defaultIndicatorConfig } from "./ChartIndicators";
import { calculateMA, calculateEMA } from "@/lib/indicators";

export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  data: OHLCData[];
  height?: number;
  indicatorConfig?: IndicatorConfig;
  onCandleUpdate?: (candle: OHLCData) => void;
  resetZoomKey?: string;
  visibleRangeKey?: string;
}

export interface CandlestickChartRef {
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  updateCandle: (candle: OHLCData) => void;
}

export function computeNextVisibleRange(
  prevRange: { from: number; to: number } | null,
  newTotal: number,
  mode: "reset" | "preserve",
  resetWindow = 80,
): { from: number; to: number } | null {
  if (mode === "reset") {
    if (newTotal <= 0) return null;
    const visible = Math.min(resetWindow, newTotal);
    return { from: Math.max(0, newTotal - visible), to: newTotal + 3 };
  }
  if (!prevRange) return null;
  const width = prevRange.to - prevRange.from;
  const to = Math.min(prevRange.to, newTotal + 3);
  const from = Math.max(0, to - width);
  return { from, to };
}

const VISIBLE_RANGE_STORAGE_PREFIX = "stengg:chart-visible-range:v1:";
type VisibleLogicalRange = { from: number; to: number };

function getSessionStorage(): Storage | null {
  try {
    return typeof globalThis !== "undefined" && globalThis.sessionStorage ? globalThis.sessionStorage : null;
  } catch {
    return null;
  }
}

export function chartVisibleRangeStorageKey(key: string) {
  return `${VISIBLE_RANGE_STORAGE_PREFIX}${key}`;
}

function isValidVisibleRange(range: unknown): range is VisibleLogicalRange {
  if (!range || typeof range !== "object") return false;
  const v = range as { from?: unknown; to?: unknown };
  return (
    typeof v.from === "number" &&
    typeof v.to === "number" &&
    Number.isFinite(v.from) &&
    Number.isFinite(v.to) &&
    v.to > v.from
  );
}

export function readStoredVisibleRange(key: string | undefined, newTotal: number): VisibleLogicalRange | null {
  const storage = getSessionStorage();
  if (!key || !storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(chartVisibleRangeStorageKey(key)) || "null");
    if (!isValidVisibleRange(parsed)) return null;
    return computeNextVisibleRange(parsed, newTotal, "preserve");
  } catch {
    storage.removeItem(chartVisibleRangeStorageKey(key));
    return null;
  }
}

export function writeStoredVisibleRange(key: string | undefined, range: VisibleLogicalRange | null) {
  const storage = getSessionStorage();
  if (!key || !storage || !isValidVisibleRange(range)) return;
  try {
    storage.setItem(chartVisibleRangeStorageKey(key), JSON.stringify({ from: range.from, to: range.to }));
  } catch {
    storage.removeItem(chartVisibleRangeStorageKey(key));
  }
}

const toTimestamp = (isoTime: string): UTCTimestamp => Math.floor(new Date(isoTime).getTime() / 1000) as UTCTimestamp;

const dedupeAndSortOHLC = (data: OHLCData[]): CandlestickData<UTCTimestamp>[] => {
  const map = new Map<number, CandlestickData<UTCTimestamp>>();
  for (const d of data) {
    const time = toTimestamp(d.time);
    map.set(time, { time, open: d.open, high: d.high, low: d.low, close: d.close });
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

const dedupeAndSortIndicator = (data: { time: string; value: number }[]): LineData<UTCTimestamp>[] => {
  const map = new Map<number, LineData<UTCTimestamp>>();
  for (const d of data) {
    const time = toTimestamp(d.time);
    map.set(time, { time, value: d.value });
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

const dedupeAndSortVolume = (data: OHLCData[]): HistogramData<UTCTimestamp>[] => {
  const map = new Map<number, HistogramData<UTCTimestamp>>();
  for (const d of data) {
    const time = toTimestamp(d.time);
    const isBull = d.close >= d.open;
    map.set(time, {
      time,
      value: d.volume ?? 0,
      // TradingView style: bull = teal/green, bear = red/brown — semi-transparent
      color: isBull ? "rgba(38,166,154,0.45)" : "rgba(239,83,80,0.40)",
    });
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
};

export const CandlestickChart = forwardRef<CandlestickChartRef, CandlestickChartProps>(
  (
    { data, height = 400, indicatorConfig = defaultIndicatorConfig, onCandleUpdate, resetZoomKey, visibleRangeKey },
    ref,
  ) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const lastDataRef = useRef<string>("");
    const lastShapeRef = useRef<string>("");
    const lastResetKeyRef = useRef<string | undefined>(undefined);
    const hasInitialDataRef = useRef<boolean>(false);
    const visibleRangeKeyRef = useRef<string | undefined>(visibleRangeKey);
    const visibleRangeAppliedKeyRef = useRef<string | undefined>(undefined);
    const suppressVisibleRangeWriteRef = useRef(false);
    const releaseRangeWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const releaseRangeWriteFrameRef = useRef<number | null>(null);
    const hasChartData = data.length > 0;

    const suppressVisibleRangeWrites = useCallback(() => {
      suppressVisibleRangeWriteRef.current = true;
      if (releaseRangeWriteTimerRef.current) clearTimeout(releaseRangeWriteTimerRef.current);
      if (releaseRangeWriteFrameRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(releaseRangeWriteFrameRef.current);
      }
      const release = () => {
        releaseRangeWriteTimerRef.current = setTimeout(() => {
          suppressVisibleRangeWriteRef.current = false;
        }, 75);
      };
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        releaseRangeWriteFrameRef.current = window.requestAnimationFrame(() => {
          releaseRangeWriteFrameRef.current = window.requestAnimationFrame(release);
        });
      } else {
        release();
      }
    }, []);

    useEffect(() => {
      visibleRangeKeyRef.current = visibleRangeKey;
    }, [visibleRangeKey]);

    const maData = useMemo(() => {
      if (!indicatorConfig.ma.enabled) return [];
      return calculateMA(data, indicatorConfig.ma.period);
    }, [data, indicatorConfig.ma.enabled, indicatorConfig.ma.period]);

    const emaData = useMemo(() => {
      if (!indicatorConfig.ema.enabled) return [];
      return calculateEMA(data, indicatorConfig.ema.period);
    }, [data, indicatorConfig.ema.enabled, indicatorConfig.ema.period]);

    const handleZoomIn = useCallback(() => {
      if (!chartRef.current) return;
      const ts = chartRef.current.timeScale();
      const r = ts.getVisibleLogicalRange();
      if (r) ts.setVisibleLogicalRange({ from: r.from + (r.to - r.from) * 0.15, to: r.to - (r.to - r.from) * 0.15 });
    }, []);

    const handleZoomOut = useCallback(() => {
      if (!chartRef.current) return;
      const ts = chartRef.current.timeScale();
      const r = ts.getVisibleLogicalRange();
      if (r) ts.setVisibleLogicalRange({ from: r.from - (r.to - r.from) * 0.25, to: r.to + (r.to - r.from) * 0.25 });
    }, []);

    const handleResetZoom = useCallback(() => {
      chartRef.current?.timeScale().fitContent();
    }, []);

    const updateCandle = useCallback(
      (candle: OHLCData) => {
        if (!candleSeriesRef.current) return;
        candleSeriesRef.current.update({
          time: toTimestamp(candle.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        });
        onCandleUpdate?.(candle);
      },
      [onCandleUpdate],
    );

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: handleZoomIn,
        zoomOut: handleZoomOut,
        resetZoom: handleResetZoom,
        updateCandle,
      }),
      [handleZoomIn, handleZoomOut, handleResetZoom, updateCandle],
    );

    // ── Chart init ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (!hasChartData || !chartContainerRef.current) return;

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "#131722" }, // TradingView dark bg
          textColor: "#b2b5be",
          fontSize: 11,
        },
        grid: {
          // TradingView: very faint grid, barely visible
          vertLines: { color: "rgba(42,46,57,0.8)" },
          horzLines: { color: "rgba(42,46,57,0.8)" },
        },
        width: chartContainerRef.current.clientWidth,
        height,
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
          borderColor: "#2a2e39",
          // Wider spacing = TradingView feel
          barSpacing: 10,
          minBarSpacing: 2,
          rightOffset: 5,
        },
        rightPriceScale: {
          borderColor: "#2a2e39",
          // Leave 30% bottom for volume
          scaleMargins: { top: 0.06, bottom: 0.28 },
          minimumWidth: 72,
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            width: 1,
            color: "rgba(224,227,235,0.3)",
            style: 3, // dotted
            labelBackgroundColor: "#363a45",
          },
          horzLine: {
            width: 1,
            color: "rgba(224,227,235,0.3)",
            style: 3,
            labelBackgroundColor: "#363a45",
          },
        },
        localization: {
          priceFormatter: (price: number) => {
            if (price >= 10000) return `$${(price / 1000).toFixed(2)}K`;
            if (price >= 1000)
              return `$${price.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (price >= 1) return `$${price.toFixed(2)}`;
            return `$${price.toFixed(4)}`;
          },
        },
      });

      // ── Volume — rendered FIRST so it sits behind candles ──
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol_scale",
      });
      chart.priceScale("vol_scale").applyOptions({
        scaleMargins: { top: 0.72, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;

      // ── Candlestick — TradingView default style ──
      const candleSeries = chart.addSeries(CandlestickSeries, {
        // Bull candle: hollow body teal border, filled teal
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderUpColor: "#26a69a",
        borderDownColor: "#ef5350",
        // Wicks same color as body for consistency
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        borderVisible: true,
        wickVisible: true,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current)
          chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      };
      window.addEventListener("resize", handleResize);

      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && chartContainerRef.current) {
        ro = new ResizeObserver(() => {
          if (!chartContainerRef.current || !chartRef.current) return;
          const w = chartContainerRef.current.clientWidth;
          if (w > 0) chartRef.current.applyOptions({ width: w });
        });
        ro.observe(chartContainerRef.current);
      }

      const onRangeChange = (range: VisibleLogicalRange | null) => {
        if (!suppressVisibleRangeWriteRef.current) writeStoredVisibleRange(visibleRangeKeyRef.current, range);
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

      return () => {
        window.removeEventListener("resize", handleResize);
        ro?.disconnect();
        if (releaseRangeWriteTimerRef.current) clearTimeout(releaseRangeWriteTimerRef.current);
        if (releaseRangeWriteFrameRef.current) window.cancelAnimationFrame(releaseRangeWriteFrameRef.current);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        maSeriesRef.current = null;
        emaSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    }, [height, hasChartData]);

    // ── Data updates ─────────────────────────────────────────────────────────
    useEffect(() => {
      if (!candleSeriesRef.current || !chartRef.current || data.length === 0) return;

      const dataHash = `${data.length}_${data[data.length - 1]?.time}_${data[data.length - 1]?.close}`;
      const dataShape = `${data.length}_${data[0]?.time}_${data[data.length - 2]?.time}_${data[data.length - 1]?.time}`;
      const vrChanged = visibleRangeKey !== visibleRangeAppliedKeyRef.current;

      if (dataHash === lastDataRef.current && !vrChanged) return;
      const prevShape = lastShapeRef.current;
      lastDataRef.current = dataHash;
      lastShapeRef.current = dataShape;

      const fmtData = dedupeAndSortOHLC(data);
      const volData = dedupeAndSortVolume(data);
      const isFirstLoad = !hasInitialDataRef.current;
      const resetChanged = resetZoomKey !== lastResetKeyRef.current;
      const sameShape = !!lastDataRef.current && prevShape === dataShape;
      const ts = chartRef.current.timeScale();

      if (isFirstLoad || resetChanged) {
        suppressVisibleRangeWrites();
        candleSeriesRef.current.setData(fmtData);
        volumeSeriesRef.current?.setData(volData);
        const next =
          readStoredVisibleRange(visibleRangeKey, fmtData.length) ??
          computeNextVisibleRange(null, fmtData.length, "reset");
        if (next) {
          suppressVisibleRangeWrites();
          ts.setVisibleLogicalRange(next);
          writeStoredVisibleRange(visibleRangeKey, next);
        }
        hasInitialDataRef.current = true;
        lastResetKeyRef.current = resetZoomKey;
        visibleRangeAppliedKeyRef.current = visibleRangeKey;
      } else if (sameShape) {
        const last = fmtData[fmtData.length - 1];
        const lastVol = volData[volData.length - 1];
        if (last) {
          try {
            candleSeriesRef.current.update(last);
            if (lastVol) volumeSeriesRef.current?.update(lastVol);
            if (vrChanged) {
              const r = readStoredVisibleRange(visibleRangeKey, fmtData.length);
              if (r) {
                suppressVisibleRangeWrites();
                ts.setVisibleLogicalRange(r);
                writeStoredVisibleRange(visibleRangeKey, r);
              }
            }
            visibleRangeAppliedKeyRef.current = visibleRangeKey;
          } catch {
            const pr = ts.getVisibleLogicalRange();
            suppressVisibleRangeWrites();
            candleSeriesRef.current.setData(fmtData);
            volumeSeriesRef.current?.setData(volData);
            if (pr) {
              suppressVisibleRangeWrites();
              ts.setVisibleLogicalRange(pr);
              writeStoredVisibleRange(visibleRangeKey, pr);
            }
          }
        }
      } else {
        const prevRange = ts.getVisibleLogicalRange();
        suppressVisibleRangeWrites();
        candleSeriesRef.current.setData(fmtData);
        volumeSeriesRef.current?.setData(volData);
        const restored = vrChanged ? readStoredVisibleRange(visibleRangeKey, fmtData.length) : null;
        const next = restored ?? computeNextVisibleRange(prevRange, fmtData.length, "preserve");
        if (next) {
          suppressVisibleRangeWrites();
          ts.setVisibleLogicalRange(next);
          writeStoredVisibleRange(visibleRangeKey, next);
        }
        visibleRangeAppliedKeyRef.current = visibleRangeKey;
      }

      // MA — thin blue line, TradingView default MA color
      if (indicatorConfig.ma.enabled && maData.length > 0) {
        if (!maSeriesRef.current) {
          maSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: "#2196f3",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
        }
        maSeriesRef.current.setData(dedupeAndSortIndicator(maData));
      } else if (maSeriesRef.current) {
        chartRef.current.removeSeries(maSeriesRef.current);
        maSeriesRef.current = null;
      }

      // EMA — orange, TradingView default EMA color
      if (indicatorConfig.ema.enabled && emaData.length > 0) {
        if (!emaSeriesRef.current) {
          emaSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: "#ff9800",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });
        }
        emaSeriesRef.current.setData(dedupeAndSortIndicator(emaData));
      } else if (emaSeriesRef.current) {
        chartRef.current.removeSeries(emaSeriesRef.current);
        emaSeriesRef.current = null;
      }
    }, [data, indicatorConfig, maData, emaData, resetZoomKey, visibleRangeKey, suppressVisibleRangeWrites]);

    if (data.length === 0) {
      return (
        <div
          className="flex items-center justify-center text-[#b2b5be] text-xs tracking-wider"
          style={{ height, background: "#131722" }}
        >
          <span className="animate-pulse opacity-50">Loading chart data…</span>
        </div>
      );
    }

    return <div ref={chartContainerRef} style={{ background: "#131722" }} />;
  },
);

CandlestickChart.displayName = "CandlestickChart";
