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

/** Apply a tick to engine state, returns new state */
export function applyTick(
  state: EngineState,
  scenario: ProductScenario,
  activeShock: ShockEvent | null
): { newState: EngineState; updatedShock: ShockEvent | null } {
  const { candle, updatedShock } = generateNextTick(state, scenario, activeShock);
  
  const newCandles = [...state.candles.slice(-(MAX_CANDLES - 1)), candle];
  
  return {
    newState: {
      ...state,
      candles: newCandles,
      lastUpdatedAt: Date.now(),
      tickCount: state.tickCount + 1,
    },
    updatedShock,
  };
}
