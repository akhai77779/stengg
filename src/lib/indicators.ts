import { OHLCData } from '@/components/charts/CandlestickChart';

export interface IndicatorPoint {
  time: string;
  value: number;
}

/**
 * Calculate Simple Moving Average (SMA/MA)
 */
export function calculateMA(data: OHLCData[], period: number): IndicatorPoint[] {
  if (data.length < period) return [];
  
  const result: IndicatorPoint[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: data[i].time,
      value: sum / period,
    });
  }
  
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(data: OHLCData[], period: number): IndicatorPoint[] {
  if (data.length < period) return [];
  
  const result: IndicatorPoint[] = [];
  const multiplier = 2 / (period + 1);
  
  // Calculate initial SMA for the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  
  result.push({
    time: data[period - 1].time,
    value: ema,
  });
  
  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: data[i].time,
      value: ema,
    });
  }
  
  return result;
}
