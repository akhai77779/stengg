import { Candle, Product, TimeInterval } from "@/types/trading";

/**
 * Market regime — mỗi "phase" kéo dài 30–120 nến, tạo ra cấu trúc sóng thật
 * giống BTC/ETH: tích lũy → bứt phá → pullback → tích lũy...
 */
type Regime =
  | "accumulation" // sideway hẹp, volume thấp
  | "markup" // trending up mạnh
  | "distribution" // sideway rộng, đỉnh
  | "markdown" // trending down mạnh
  | "pullback" // hồi nhẹ trong uptrend
  | "relief" // hồi nhẹ trong downtrend
  | "volatile_spike"; // nến đột biến (news event)

interface RegimeConfig {
  trendBias: number; // -1 đến +1, xác suất tăng
  volatilityMult: number; // nhân với base volatility
  momentumCarry: number; // autocorrelation 0–1
  durationMin: number; // nến tối thiểu
  durationMax: number; // nến tối đa
  volumeMult: number; // nhân với base volume
}

const REGIME_CONFIGS: Record<Regime, RegimeConfig> = {
  accumulation: {
    trendBias: 0.02,
    volatilityMult: 0.4,
    momentumCarry: 0.3,
    durationMin: 60,
    durationMax: 180,
    volumeMult: 0.6,
  },
  markup: {
    trendBias: 0.55,
    volatilityMult: 1.1,
    momentumCarry: 0.7,
    durationMin: 40,
    durationMax: 120,
    volumeMult: 1.8,
  },
  distribution: {
    trendBias: -0.05,
    volatilityMult: 0.7,
    momentumCarry: 0.2,
    durationMin: 30,
    durationMax: 90,
    volumeMult: 1.2,
  },
  markdown: {
    trendBias: -0.55,
    volatilityMult: 1.2,
    momentumCarry: 0.7,
    durationMin: 40,
    durationMax: 100,
    volumeMult: 2.0,
  },
  pullback: {
    trendBias: -0.3,
    volatilityMult: 0.8,
    momentumCarry: 0.5,
    durationMin: 15,
    durationMax: 45,
    volumeMult: 0.9,
  },
  relief: {
    trendBias: 0.3,
    volatilityMult: 0.8,
    momentumCarry: 0.5,
    durationMin: 15,
    durationMax: 45,
    volumeMult: 0.9,
  },
  volatile_spike: {
    trendBias: 0.0,
    volatilityMult: 3.5,
    momentumCarry: 0.1,
    durationMin: 3,
    durationMax: 12,
    volumeMult: 4.0,
  },
};

/**
 * Transition table: sau mỗi regime xong, tiếp theo là gì (weighted random)
 * Giống BTC thật: accumulation → markup → pullback → markup → distribution → markdown
 */
const REGIME_TRANSITIONS: Record<Regime, Array<{ next: Regime; weight: number }>> = {
  accumulation: [
    { next: "markup", weight: 0.6 },
    { next: "volatile_spike", weight: 0.15 },
    { next: "accumulation", weight: 0.25 },
  ],
  markup: [
    { next: "pullback", weight: 0.45 },
    { next: "distribution", weight: 0.3 },
    { next: "volatile_spike", weight: 0.1 },
    { next: "markup", weight: 0.15 },
  ],
  distribution: [
    { next: "markdown", weight: 0.5 },
    { next: "markup", weight: 0.25 },
    { next: "volatile_spike", weight: 0.1 },
    { next: "accumulation", weight: 0.15 },
  ],
  markdown: [
    { next: "relief", weight: 0.45 },
    { next: "accumulation", weight: 0.3 },
    { next: "volatile_spike", weight: 0.1 },
    { next: "markdown", weight: 0.15 },
  ],
  pullback: [
    { next: "markup", weight: 0.65 },
    { next: "accumulation", weight: 0.2 },
    { next: "markdown", weight: 0.15 },
  ],
  relief: [
    { next: "markdown", weight: 0.6 },
    { next: "accumulation", weight: 0.25 },
    { next: "markup", weight: 0.15 },
  ],
  volatile_spike: [
    { next: "markup", weight: 0.35 },
    { next: "markdown", weight: 0.35 },
    { next: "accumulation", weight: 0.3 },
  ],
};

function pickNextRegime(current: Regime): Regime {
  const options = REGIME_TRANSITIONS[current];
  const r = Math.random();
  let cumulative = 0;
  for (const { next, weight } of options) {
    cumulative += weight;
    if (r < cumulative) return next;
  }
  return options[options.length - 1].next;
}

/** Weighted starting regime based on product trend */
function pickStartingRegime(trend: string): Regime {
  const r = Math.random();
  if (trend === "bullish") {
    if (r < 0.4) return "markup";
    if (r < 0.65) return "accumulation";
    if (r < 0.8) return "pullback";
    return "distribution";
  }
  if (trend === "bearish") {
    if (r < 0.4) return "markdown";
    if (r < 0.65) return "distribution";
    if (r < 0.8) return "relief";
    return "accumulation";
  }
  if (trend === "volatile") {
    if (r < 0.3) return "volatile_spike";
    if (r < 0.6) return "markup";
    if (r < 0.8) return "markdown";
    return "accumulation";
  }
  // neutral
  if (r < 0.5) return "accumulation";
  if (r < 0.75) return "pullback";
  return "distribution";
}

/**
 * Generate realistic 1-minute candles using a Markov regime chain.
 *
 * Pattern: chuỗi regime thay đổi theo Markov → tạo cấu trúc sóng giống BTC/ETH:
 *   tích lũy → bứt phá → pullback → bứt phá tiếp → phân phối → giảm → phục hồi...
 *
 * Mỗi nến có:
 *   - Autocorrelation (momentum carry) trong cùng regime
 *   - Volume tỉ lệ với biên độ nến
 *   - Wicks ngẫu nhiên thực tế (wick lớn hơn khi volatile)
 *   - Clamp an toàn để không drift về 0
 */
export function generateBase1MCandles(product: Product, count: number): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const base = product.basePrice;
  const vol = product.volatility;

  // Safe band — tighter for large-cap, wider for volatile micro-caps
  const bandPct = base < 1 ? 0.6 : base < 10 ? 0.45 : 0.35;
  const minPrice = base * (1 - bandPct);
  const maxPrice = base * (1 + bandPct);

  let price = base;
  let momentum = 0;

  // Build regime sequence upfront
  let currentRegime = pickStartingRegime(product.trend || "neutral");
  let regimeConfig = REGIME_CONFIGS[currentRegime];
  let regimeDuration = Math.floor(
    regimeConfig.durationMin + Math.random() * (regimeConfig.durationMax - regimeConfig.durationMin),
  );
  let regimeTick = 0;

  for (let i = count; i > 0; i--) {
    // Advance regime if current one is done
    if (regimeTick >= regimeDuration) {
      currentRegime = pickNextRegime(currentRegime);
      regimeConfig = REGIME_CONFIGS[currentRegime];
      regimeDuration = Math.floor(
        regimeConfig.durationMin + Math.random() * (regimeConfig.durationMax - regimeConfig.durationMin),
      );
      regimeTick = 0;
      // Partial momentum reset on regime change
      momentum *= 0.3;
    }
    regimeTick++;

    const { trendBias, volatilityMult, momentumCarry, volumeMult } = regimeConfig;
    const effectiveVol = vol * volatilityMult;

    // Carry momentum + pull toward regime bias
    momentum = momentum * momentumCarry + trendBias * (1 - momentumCarry);
    momentum = Math.max(-0.9, Math.min(0.9, momentum));

    // Up probability: base 50% + momentum influence
    const upProb = Math.max(0.05, Math.min(0.95, 0.5 + momentum * 0.35));
    const direction = Math.random() < upProb ? 1 : -1;

    // Change size: log-normal-ish distribution (occasional big moves)
    const baseChange = price * effectiveVol * (0.4 + Math.random() * 0.8);
    const outlier = Math.random() < 0.04 ? 2.5 + Math.random() * 2 : 1; // 4% chance of spike
    const change = baseChange * direction * outlier;

    const open = price;
    let close = open + change;

    // Soft clamp with bounce
    if (close < minPrice) {
      close = minPrice + (minPrice - close) * 0.3;
      momentum = Math.abs(momentum) * 0.5 + 0.15; // bounce pushes up
    } else if (close > maxPrice) {
      close = maxPrice - (close - maxPrice) * 0.3;
      momentum = -(Math.abs(momentum) * 0.5 + 0.15); // bounce pushes down
    }

    if (!Number.isFinite(close) || close <= 0) close = price;

    // Realistic wicks: larger wicks during volatile regimes
    const wickMult = volatilityMult * (0.3 + Math.random() * 0.5);
    const high = Math.max(open, close) * (1 + Math.random() * effectiveVol * wickMult);
    const low = Math.min(open, close) * (1 - Math.random() * effectiveVol * wickMult);

    // Volume: tied to candle size + regime activity
    const bodyPct = Math.abs(close - open) / open;
    const baseVol = (base * 300 * volumeMult) / count;
    const volume = baseVol * (0.5 + Math.random() * 0.8) * (1 + (bodyPct / effectiveVol) * 1.2);

    candles.push({
      time: now - i * 60,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
    // Update momentum based on actual outcome
    momentum = momentum * 0.75 + ((close - open) / open / (effectiveVol || 0.001)) * 0.25;
    momentum = Math.max(-0.9, Math.min(0.9, momentum));
  }

  return candles;
}

/**
 * Aggregate 1M candles into larger timeframes
 */
export function aggregateCandles(candles: Candle[], interval: TimeInterval): Candle[] {
  const minutesMap: Record<TimeInterval, number> = {
    "1M": 1,
    "5M": 5,
    "15M": 15,
    "30M": 30,
    "1H": 60,
    "1D": 1440,
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
