import { Product } from "@/types/trading";

export const PRODUCTS: Product[] = [
  // 🟢 Bullish mạnh - sản phẩm chủ lực, tăng ổn định
  {
    id: "agil",
    name: "AGIL 5G-in-a-Box",
    symbol: "AGIL/USDT",
    basePrice: 601.94,
    volatility: 0.008,
    trend: "bullish",
    category: "Defense",
  },
  // 🟢 Bullish nhẹ - tăng chậm, ổn định
  {
    id: "360sa",
    name: "360 Situational Awareness System",
    symbol: "360SA/USDT",
    basePrice: 40.75,
    volatility: 0.007,
    trend: "bullish",
    category: "Defense",
  },
  // ⚪ Sideway - đi ngang, volatility thấp nhưng vẫn có dao động thấy được
  {
    id: "mcs",
    name: "Modular Computing Server",
    symbol: "MCS/USDT",
    basePrice: 14.51,
    volatility: 0.006,
    trend: "neutral",
    category: "Technology",
  },
  // 🟢 Bullish mạnh + volatility cao - tăng nhưng rung lắc nhiều
  {
    id: "sim",
    name: "SATCOM Integrated Module",
    symbol: "SIM/USDT",
    basePrice: 9.06,
    volatility: 0.022,
    trend: "bullish",
    category: "Communications",
  },
  // ⚪ Sideway - dao động nhẹ nhìn thấy được
  {
    id: "cotm",
    name: "Communications-on-the-Move",
    symbol: "COTM/USDT",
    basePrice: 9.12,
    volatility: 0.008,
    trend: "neutral",
    category: "Communications",
  },
  // 🔴 Bearish mạnh - giảm rõ ràng
  {
    id: "ibms",
    name: "Integrated Battlefield Management System",
    symbol: "IBMS/USDT",
    basePrice: 2.69,
    volatility: 0.014,
    trend: "bearish",
    category: "Defense",
  },
  // 🟡 Volatile - basePrice nâng lên $1 để biến động tuyệt đối nhìn thấy được
  // Giữ tỉ lệ % giống nhau, chỉ scale price lên cho chart đẹp
  {
    id: "vics",
    name: "Vehicular Integrated Communications System",
    symbol: "VICS/USDT",
    basePrice: 1.0,
    volatility: 0.035,
    trend: "volatile",
    category: "Defense",
  },
  // 🔴 Bearish nhẹ + volatility vừa
  {
    id: "hed",
    name: "Hybrid Electric Drive",
    symbol: "HED/USDT",
    basePrice: 6.49,
    volatility: 0.018,
    trend: "bearish",
    category: "Technology",
  },
  // ⚪ Sideway - nâng volatility để chart không flatline
  {
    id: "c5isr",
    name: "C5ISR",
    symbol: "C5ISR/USDT",
    basePrice: 55.2,
    volatility: 0.009,
    trend: "neutral",
    category: "Defense",
  },
  // 🟡 Volatile vừa - dao động mạnh, basePrice hợp lý hơn
  {
    id: "wig",
    name: "Wing-in-Ground",
    symbol: "WIG/USDT",
    basePrice: 12.5,
    volatility: 0.022,
    trend: "volatile",
    category: "Aerospace",
  },
];
