import { Product } from '@/types/trading';

export const PRODUCTS: Product[] = [
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC/USDT', basePrice: 67500, volatility: 0.008, trend: 'bullish', category: 'Crypto' },
  { id: 'eth', name: 'Ethereum', symbol: 'ETH/USDT', basePrice: 3450, volatility: 0.01, trend: 'bullish', category: 'Crypto' },
  { id: 'bnb', name: 'BNB', symbol: 'BNB/USDT', basePrice: 580, volatility: 0.009, trend: 'neutral', category: 'Crypto' },
  { id: 'sol', name: 'Solana', symbol: 'SOL/USDT', basePrice: 145, volatility: 0.015, trend: 'bullish', category: 'Crypto' },
  { id: 'xrp', name: 'XRP', symbol: 'XRP/USDT', basePrice: 0.62, volatility: 0.012, trend: 'neutral', category: 'Crypto' },
  { id: 'ada', name: 'Cardano', symbol: 'ADA/USDT', basePrice: 0.45, volatility: 0.014, trend: 'bearish', category: 'Crypto' },
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE/USDT', basePrice: 0.12, volatility: 0.018, trend: 'volatile', category: 'Crypto' },
  { id: 'avax', name: 'Avalanche', symbol: 'AVAX/USDT', basePrice: 35, volatility: 0.013, trend: 'neutral', category: 'Crypto' },
  { id: 'gold', name: 'Gold', symbol: 'XAU/USD', basePrice: 2350, volatility: 0.004, trend: 'bullish', category: 'Commodity' },
  { id: 'oil', name: 'Crude Oil', symbol: 'WTI/USD', basePrice: 78.5, volatility: 0.006, trend: 'neutral', category: 'Commodity' },
];
