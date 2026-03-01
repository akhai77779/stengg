import { Candle, Product } from '@/types/trading';

/** Layer 1: Per-product scenario configuration */
export interface ProductScenario {
  productId: string;
  trend: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  volatility: number; // 0.001 - 0.05
  basePrice: number;
  /** Optional: override trend strength 0-1 */
  trendStrength?: number;
}

/** Layer 2: Live engine state for a single product */
export interface EngineState {
  productId: string;
  candles: Candle[];
  lastUpdatedAt: number; // unix ms
  tickCount: number;
}

/** Layer 4: Shock event - move price to target in duration */
export interface ShockEvent {
  id: string;
  productId: string;
  targetPrice: number;
  durationMinutes: number;
  direction: 'up' | 'down';
  startedAt: number; // unix ms
  startPrice: number;
  /** How many ticks have been applied */
  ticksApplied: number;
  /** Total ticks needed (durationMinutes * 60 / tickIntervalSec) */
  totalTicks: number;
  isComplete: boolean;
}

/** Full persisted state */
export interface MarketEngineSnapshot {
  version: number;
  savedAt: number;
  engines: Record<string, EngineState>;
  shockEvents: ShockEvent[];
  scenarios: Record<string, ProductScenario>;
}

export const TICK_INTERVAL_MS = 3000; // 3 seconds per tick
export const MAX_CANDLES = 1440; // 24h of 1M candles
export const SNAPSHOT_KEY = 'admin_market_engine_v2';
