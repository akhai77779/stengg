import { Candle } from '@/types/trading';
import { EngineState, ProductScenario, ShockEvent, MAX_CANDLES } from './types';
import { getTrendBias } from './scenarios';
import { generateBase1MCandles } from '@/lib/chartUtils';
import { PRODUCTS } from '@/data/products';

/**
 * Layer 2: Live Engine
 * Manages running state for each product, generates new candles each tick.
 * Applies shock events when active.
 */

export function createEngineState(scenario: ProductScenario): EngineState {
  const product = PRODUCTS.find(p => p.id === scenario.productId);
  if (!product) {
    throw new Error(`Product not found: ${scenario.productId}`);
  }
  
  const candles = generateBase1MCandles(product, MAX_CANDLES);
  return {
    productId: scenario.productId,
    candles,
    lastUpdatedAt: Date.now(),
    tickCount: 0,
  };
}

/** Generate next candle for a product, considering active shock events */
export function generateNextTick(
  state: EngineState,
  scenario: ProductScenario,
  activeShock: ShockEvent | null
): { candle: Candle; updatedShock: ShockEvent | null } {
  const lastCandle = state.candles[state.candles.length - 1];
  if (!lastCandle) throw new Error('No candles in state');

  let close: number;
  let updatedShock = activeShock;

  if (activeShock && !activeShock.isComplete) {
    // Shock event active: interpolate toward target price
    const remaining = activeShock.totalTicks - activeShock.ticksApplied;
    if (remaining <= 1) {
      // Final tick - hit the target
      close = activeShock.targetPrice;
      updatedShock = { ...activeShock, ticksApplied: activeShock.totalTicks, isComplete: true };
    } else {
      // Gradual move with some noise
      const priceGap = activeShock.targetPrice - lastCandle.close;
      const stepSize = priceGap / remaining;
      // Add 20% noise for realism
      const noise = stepSize * 0.2 * (Math.random() - 0.5);
      close = lastCandle.close + stepSize + noise;
      updatedShock = { ...activeShock, ticksApplied: activeShock.ticksApplied + 1 };
    }
  } else {
    // Normal generation based on scenario
    const trendBias = getTrendBias(scenario);
    const direction = Math.random() < 0.5 + trendBias * 0.1 ? 1 : -1;
    const change = lastCandle.close * scenario.volatility * direction * (0.5 + Math.random() * 0.5);
    close = lastCandle.close + change;
  }

  // Clamp close within a safe band around basePrice to prevent drift to 0
  // or unrealistic explosions. Allowed band: [basePrice * 0.7, basePrice * 1.3].
  const base = scenario.basePrice || lastCandle.close || 1;
  const minPrice = base * 0.7;
  const maxPrice = base * 1.3;
  if (!Number.isFinite(close) || close <= 0) close = base;
  if (close < minPrice) {
    // Soft bounce back toward base
    close = minPrice + (base - minPrice) * 0.1 * Math.random();
  } else if (close > maxPrice) {
    close = maxPrice - (maxPrice - base) * 0.1 * Math.random();
  }

  const open = lastCandle.close;
  const high = Math.max(open, close) * (1 + Math.random() * scenario.volatility * 0.5);
  const low = Math.min(open, close) * (1 - Math.random() * scenario.volatility * 0.5);
  const volume = 1000000 * (0.8 + Math.random() * 0.4) / MAX_CANDLES;

  const candle: Candle = {
    time: lastCandle.time + 60,
    open,
    high,
    low,
    close,
    volume,
  };

  return { candle, updatedShock };
}

/** Apply a tick to engine state, returns new state.
 * Uses real wall-clock time: updates the current candle within its minute,
 * only creates a new candle when a new minute boundary is crossed. */
export function applyTick(
  state: EngineState,
  scenario: ProductScenario,
  activeShock: ShockEvent | null
): { newState: EngineState; updatedShock: ShockEvent | null } {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentMinute = Math.floor(nowSec / 60) * 60;
  const lastCandle = state.candles[state.candles.length - 1];

  if (!lastCandle) {
    // No candles yet — create the first one
    const { candle, updatedShock: us } = generateNextTick(state, scenario, activeShock);
    candle.time = currentMinute;
    return {
      newState: { ...state, candles: [candle], lastUpdatedAt: Date.now(), tickCount: state.tickCount + 1 },
      updatedShock: us,
    };
  }

  // Generate a new price point
  const { candle: tickCandle, updatedShock } = generateNextTick(state, scenario, activeShock);

  if (currentMinute === lastCandle.time) {
    // Still within the same minute — update the existing candle in-place
    const updated: Candle = {
      ...lastCandle,
      high: Math.max(lastCandle.high, tickCandle.close),
      low: Math.min(lastCandle.low, tickCandle.close),
      close: tickCandle.close,
      volume: lastCandle.volume + tickCandle.volume,
    };
    const newCandles = [...state.candles.slice(0, -1), updated];
    return {
      newState: { ...state, candles: newCandles, lastUpdatedAt: Date.now(), tickCount: state.tickCount + 1 },
      updatedShock,
    };
  }

  // New minute boundary — create a new candle
  const newCandle: Candle = {
    time: currentMinute,
    open: lastCandle.close,
    high: Math.max(lastCandle.close, tickCandle.close),
    low: Math.min(lastCandle.close, tickCandle.close),
    close: tickCandle.close,
    volume: tickCandle.volume,
  };
  const newCandles = [...state.candles.slice(-(MAX_CANDLES - 1)), newCandle];

  return {
    newState: { ...state, candles: newCandles, lastUpdatedAt: Date.now(), tickCount: state.tickCount + 1 },
    updatedShock,
  };
}
