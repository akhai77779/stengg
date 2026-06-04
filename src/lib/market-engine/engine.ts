import { Candle } from "@/types/trading";
import { EngineState, ProductScenario, ShockEvent, MAX_CANDLES } from "./types";
import { getTrendBias } from "./scenarios";
import { generateBase1MCandles } from "@/lib/chartUtils";
import { PRODUCTS } from "@/data/products";

/**
 * Layer 2: Live Engine
 * Manages running state for each product, generates new candles each tick.
 * Applies shock events when active.
 *
 * KEY IMPROVEMENTS vs original:
 * - Momentum: price has autocorrelation — trending moves persist for a few ticks
 *   before reversing, making charts look like real markets instead of white noise.
 * - Stronger trend bias: 0.5 + trendBias*0.25 (was *0.1) so bullish/bearish is visible.
 * - Volume tied to price change magnitude (big candle = big volume).
 * - Better clamp for micro-price products (VICS $0.01, WIG $0.23).
 */

// How strongly momentum carries forward each tick (0 = none, 1 = infinite)
const MOMENTUM_CARRY = 0.65;
// Max absolute momentum value (caps runaway trends)
const MOMENTUM_MAX = 0.8;
// After this many consecutive ticks in one direction, decay momentum faster
const MOMENTUM_DECAY_AFTER = 6;

export function createEngineState(scenario: ProductScenario): EngineState {
  const product = PRODUCTS.find((p) => p.id === scenario.productId);
  if (!product) {
    throw new Error(`Product not found: ${scenario.productId}`);
  }

  const candles = generateBase1MCandles(product, MAX_CANDLES);
  return {
    productId: scenario.productId,
    candles,
    lastUpdatedAt: Date.now(),
    tickCount: 0,
    momentum: 0,
    consecutiveTicks: 0,
  };
}

/** Generate next candle for a product, considering active shock events */
export function generateNextTick(
  state: EngineState,
  scenario: ProductScenario,
  activeShock: ShockEvent | null,
): { candle: Candle; updatedShock: ShockEvent | null; newMomentum: number; newConsecutiveTicks: number } {
  const lastCandle = state.candles[state.candles.length - 1];
  if (!lastCandle) throw new Error("No candles in state");

  let close: number;
  let updatedShock = activeShock;
  let newMomentum = state.momentum ?? 0;
  let newConsecutiveTicks = state.consecutiveTicks ?? 0;

  if (activeShock && !activeShock.isComplete) {
    // Shock event active: interpolate toward target price
    const remaining = activeShock.totalTicks - activeShock.ticksApplied;
    if (remaining <= 1) {
      close = activeShock.targetPrice;
      updatedShock = { ...activeShock, ticksApplied: activeShock.totalTicks, isComplete: true };
    } else {
      const priceGap = activeShock.targetPrice - lastCandle.close;
      const stepSize = priceGap / remaining;
      // 30% noise (up from 20%) for more natural shock movement
      const noise = stepSize * 0.3 * (Math.random() - 0.5);
      close = lastCandle.close + stepSize + noise;
      updatedShock = { ...activeShock, ticksApplied: activeShock.ticksApplied + 1 };
    }
    // Shock resets momentum to match direction
    newMomentum = close > lastCandle.close ? 0.4 : -0.4;
    newConsecutiveTicks = 1;
  } else {
    // ── Normal tick with momentum ──────────────────────────────────────────
    const trendBias = getTrendBias(scenario);

    // Decay momentum faster after many consecutive same-direction ticks
    const decayFactor = newConsecutiveTicks > MOMENTUM_DECAY_AFTER ? MOMENTUM_CARRY * 0.7 : MOMENTUM_CARRY;

    // Carry forward existing momentum + pull toward trend bias
    const rawMomentum = newMomentum * decayFactor + trendBias * (1 - decayFactor);
    newMomentum = Math.max(-MOMENTUM_MAX, Math.min(MOMENTUM_MAX, rawMomentum));

    // Probability of going up: 50% base + momentum bias (max ±30%)
    // Stronger than the original *0.1 multiplier
    const upProbability = 0.5 + newMomentum * 0.3 + trendBias * 0.25;
    const goingUp = Math.random() < Math.max(0.1, Math.min(0.9, upProbability));
    const direction = goingUp ? 1 : -1;

    // Track consecutive ticks in same direction for momentum decay
    if (direction === Math.sign(newMomentum) || newMomentum === 0) {
      newConsecutiveTicks = newConsecutiveTicks + 1;
    } else {
      newConsecutiveTicks = 1;
    }

    const change = lastCandle.close * scenario.volatility * direction * (0.5 + Math.random() * 0.5);
    close = lastCandle.close + change;

    // Update momentum based on actual move (reinforces or weakens based on outcome)
    const actualMove = (close - lastCandle.close) / lastCandle.close;
    newMomentum = Math.max(
      -MOMENTUM_MAX,
      Math.min(MOMENTUM_MAX, newMomentum * 0.7 + (actualMove / scenario.volatility) * 0.3),
    );
  }

  // ── Price clamp ──────────────────────────────────────────────────────────
  // For micro-price products (< $1), use wider absolute bands not % bands
  // to avoid the price getting stuck in a tiny corridor.
  const base = scenario.basePrice || lastCandle.close || 1;
  let minPrice: number;
  let maxPrice: number;
  if (base < 0.1) {
    // Micro prices: allow ±70% deviation
    minPrice = base * 0.3;
    maxPrice = base * 1.7;
  } else if (base < 1) {
    // Small prices: ±50%
    minPrice = base * 0.5;
    maxPrice = base * 1.5;
  } else {
    // Normal prices: ±30%
    minPrice = base * 0.7;
    maxPrice = base * 1.3;
  }

  if (!Number.isFinite(close) || close <= 0) close = base;
  if (close < minPrice) {
    close = minPrice + (base - minPrice) * 0.15 * Math.random();
    // Bounce flips momentum upward
    newMomentum = Math.abs(newMomentum) * 0.5 + 0.2;
    newConsecutiveTicks = 1;
  } else if (close > maxPrice) {
    close = maxPrice - (maxPrice - base) * 0.15 * Math.random();
    // Bounce flips momentum downward
    newMomentum = -Math.abs(newMomentum) * 0.5 - 0.2;
    newConsecutiveTicks = 1;
  }

  const open = lastCandle.close;
  const high = Math.max(open, close) * (1 + Math.random() * scenario.volatility * 0.5);
  const low = Math.min(open, close) * (1 - Math.random() * scenario.volatility * 0.5);

  // ── Volume tied to price change magnitude ────────────────────────────────
  // Bigger candle body → higher volume (realistic market microstructure)
  const baseVolume = (base * 500) / MAX_CANDLES;
  const priceChangePct = Math.abs(close - open) / open;
  const volumeMultiplier = 1 + (priceChangePct / scenario.volatility) * 1.5;
  const volume = baseVolume * (0.6 + Math.random() * 0.8) * volumeMultiplier;

  const candle: Candle = {
    time: lastCandle.time + 60,
    open,
    high,
    low,
    close,
    volume,
  };

  return { candle, updatedShock, newMomentum, newConsecutiveTicks };
}

/** Apply a tick to engine state, returns new state.
 * Uses real wall-clock time: updates the current candle within its minute,
 * only creates a new candle when a new minute boundary is crossed. */
export function applyTick(
  state: EngineState,
  scenario: ProductScenario,
  activeShock: ShockEvent | null,
): { newState: EngineState; updatedShock: ShockEvent | null } {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentMinute = Math.floor(nowSec / 60) * 60;
  const lastCandle = state.candles[state.candles.length - 1];

  if (!lastCandle) {
    const {
      candle,
      updatedShock: us,
      newMomentum,
      newConsecutiveTicks,
    } = generateNextTick(state, scenario, activeShock);
    candle.time = currentMinute;
    return {
      newState: {
        ...state,
        candles: [candle],
        lastUpdatedAt: Date.now(),
        tickCount: state.tickCount + 1,
        momentum: newMomentum,
        consecutiveTicks: newConsecutiveTicks,
      },
      updatedShock: us,
    };
  }

  const {
    candle: tickCandle,
    updatedShock,
    newMomentum,
    newConsecutiveTicks,
  } = generateNextTick(state, scenario, activeShock);

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
      newState: {
        ...state,
        candles: newCandles,
        lastUpdatedAt: Date.now(),
        tickCount: state.tickCount + 1,
        momentum: newMomentum,
        consecutiveTicks: newConsecutiveTicks,
      },
      updatedShock,
    };
  }

  // New minute boundary — push a new candle, drop oldest to keep MAX_CANDLES
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
    newState: {
      ...state,
      candles: newCandles,
      lastUpdatedAt: Date.now(),
      tickCount: state.tickCount + 1,
      momentum: newMomentum,
      consecutiveTicks: newConsecutiveTicks,
    },
    updatedShock,
  };
}
