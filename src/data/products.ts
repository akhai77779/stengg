import { Product } from '@/types/trading';

export const PRODUCTS: Product[] = [
  // 🟢 Bullish mạnh - tăng rõ ràng, volatility vừa
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC/USDT', basePrice: 67500, volatility: 0.006, trend: 'bullish', category: 'Crypto' },
  // 🟢 Bullish nhẹ - tăng chậm, ổn định
  { id: 'eth', name: 'Ethereum', symbol: 'ETH/USDT', basePrice: 3450, volatility: 0.005, trend: 'bullish', category: 'Crypto' },
  // ⚪ Sideway - đi ngang, volatility rất thấp
  { id: 'bnb', name: 'BNB', symbol: 'BNB/USDT', basePrice: 580, volatility: 0.003, trend: 'neutral', category: 'Crypto' },
  // 🟢 Bullish mạnh + volatility cao - tăng nhưng rung lắc nhiều
  { id: 'sol', name: 'Solana', symbol: 'SOL/USDT', basePrice: 145, volatility: 0.022, trend: 'bullish', category: 'Crypto' },
  // ⚪ Sideway chặt - gần như không đổi
  { id: 'xrp', name: 'XRP', symbol: 'XRP/USDT', basePrice: 0.62, volatility: 0.002, trend: 'neutral', category: 'Crypto' },
  // 🔴 Bearish mạnh - giảm rõ ràng
  { id: 'ada', name: 'Cardano', symbol: 'ADA/USDT', basePrice: 0.45, volatility: 0.012, trend: 'bearish', category: 'Crypto' },
  // 🟡 Volatile cực cao - bật lên bật xuống liên tục
  { id: 'doge', name: 'Dogecoin', symbol: 'DOGE/USDT', basePrice: 0.12, volatility: 0.035, trend: 'volatile', category: 'Crypto' },
  // 🔴 Bearish nhẹ + volatility vừa
  { id: 'avax', name: 'Avalanche', symbol: 'AVAX/USDT', basePrice: 35, volatility: 0.015, trend: 'bearish', category: 'Crypto' },
  // ⚪ Sideway ổn định - commodity ít biến động
  { id: 'gold', name: 'Gold', symbol: 'XAU/USD', basePrice: 2350, volatility: 0.002, trend: 'neutral', category: 'Commodity' },
  // 🟡 Volatile vừa - giá dầu dao động mạnh
  { id: 'oil', name: 'Crude Oil', symbol: 'WTI/USD', basePrice: 78.5, volatility: 0.018, trend: 'volatile', category: 'Commodity' },
];
