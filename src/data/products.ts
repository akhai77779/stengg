import { Product } from '@/types/trading';

export const PRODUCTS: Product[] = [
  // 🟢 Bullish mạnh - sản phẩm chủ lực, tăng ổn định
  { id: 'agil', name: 'AGIL 5G-in-a-Box', symbol: 'AGIL/USDT', basePrice: 601.94, volatility: 0.006, trend: 'bullish', category: 'Defense' },
  // 🟢 Bullish nhẹ - tăng chậm, ổn định
  { id: '360sa', name: '360 Situational Awareness System', symbol: '360SA/USDT', basePrice: 40.75, volatility: 0.005, trend: 'bullish', category: 'Defense' },
  // ⚪ Sideway - đi ngang, volatility rất thấp
  { id: 'mcs', name: 'Modular Computing Server', symbol: 'MCS/USDT', basePrice: 14.51, volatility: 0.003, trend: 'neutral', category: 'Technology' },
  // 🟢 Bullish mạnh + volatility cao - tăng nhưng rung lắc nhiều
  { id: 'sim', name: 'SATCOM Integrated Module', symbol: 'SIM/USDT', basePrice: 9.06, volatility: 0.022, trend: 'bullish', category: 'Communications' },
  // ⚪ Sideway chặt - gần như không đổi
  { id: 'cotm', name: 'Communications-on-the-Move', symbol: 'COTM/USDT', basePrice: 9.12, volatility: 0.002, trend: 'neutral', category: 'Communications' },
  // 🔴 Bearish mạnh - giảm rõ ràng
  { id: 'ibms', name: 'Integrated Battlefield Management System', symbol: 'IBMS/USDT', basePrice: 2.69, volatility: 0.012, trend: 'bearish', category: 'Defense' },
  // 🟡 Volatile cực cao - bật lên bật xuống liên tục
  { id: 'vics', name: 'Vehicular Integrated Communications System', symbol: 'VICS/USDT', basePrice: 0.01, volatility: 0.035, trend: 'volatile', category: 'Defense' },
  // 🔴 Bearish nhẹ + volatility vừa
  { id: 'hed', name: 'Hybrid Electric Drive', symbol: 'HED/USDT', basePrice: 6.49, volatility: 0.015, trend: 'bearish', category: 'Technology' },
  // ⚪ Sideway ổn định
  { id: 'c5isr', name: 'C5ISR', symbol: 'C5ISR/USDT', basePrice: 1.00, volatility: 0.002, trend: 'neutral', category: 'Defense' },
  // 🟡 Volatile vừa - dao động mạnh
  { id: 'wig', name: 'Wing-in-Ground', symbol: 'WIG/USDT', basePrice: 0.23, volatility: 0.018, trend: 'volatile', category: 'Aerospace' },
];
