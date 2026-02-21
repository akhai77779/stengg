export type TimeInterval = '1M' | '5M' | '15M' | '30M' | '1H' | '1D';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Product {
  id: string;
  name: string;
  symbol: string;
  basePrice: number;
  volatility: number;
  trend: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  category: string;
  imageUrl?: string;
}

export interface TechnicalIndicators {
  ma20: number[];
  ma50: number[];
  rsi: number;
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
}
