import { Candle, Product, TimeInterval } from '@/types/trading';

/**
 * Generate base 1-minute candles for a product
 */
export function generateBase1MCandles(product: Product, count: number): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  let price = product.basePrice;

  for (let i = count; i > 0; i--) {
    const time = now - i * 60;
    const volatility = product.volatility;
    
    let trendBias = 0;
    if (product.trend === 'bullish') trendBias = 0.3;
    else if (product.trend === 'bearish') trendBias = -0.3;
    else if (product.trend === 'volatile') trendBias = (Math.random() - 0.5) * 1.5;

    const direction = Math.random() < 0.5 + trendBias * 0.1 ? 1 : -1;
    const change = price * volatility * direction * (0.3 + Math.random() * 0.7);

    const open = price;
    const close = open + change;
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.3);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.3);
    const volume = 1000000 * (0.8 + Math.random() * 0.4) / count;

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }

  return candles;
}

/**
 * Aggregate 1M candles into larger timeframes
 */
export function aggregateCandles(candles: Candle[], interval: TimeInterval): Candle[] {
  const minutesMap: Record<TimeInterval, number> = {
    '1M': 1, '5M': 5, '15M': 15, '30M': 30, '1H': 60, '1D': 1440,
  };
  const minutes = minutesMap[interval];
  if (minutes === 1) return candles;

  const bucketSize = minutes * 60;
  const buckets = new Map<number, Candle>();

  for (const c of candles) {
    const key = Math.floor(c.time / bucketSize) * bucketSize;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, { ...c, time: key });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    result.push(sum / period);
  }
  return result;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(data: number[], period: number = 14): number {
  if (data.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Calculate MACD
 */
export function calculateMACD(data: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  const macdLine: number[] = [];
  const offset = ema12.length - ema26.length;
  
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }

  const signal = calculateEMA(macdLine, 9);
  const histogramOffset = macdLine.length - signal.length;
  const histogram: number[] = [];
  
  for (let i = 0; i < signal.length; i++) {
    histogram.push(macdLine[i + histogramOffset] - signal[i]);
  }

  return { macd: macdLine, signal, histogram };
}

function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  let ema = sum / period;
  result.push(ema);

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}
