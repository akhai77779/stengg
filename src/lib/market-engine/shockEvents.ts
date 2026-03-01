import { ShockEvent, TICK_INTERVAL_MS } from './types';

/**
 * Layer 4: Shock Events
 * Create time-limited price movement commands:
 * "Move BTC to $70,000 in 5 minutes"
 */

let shockIdCounter = 0;

export function createShockEvent(
  productId: string,
  currentPrice: number,
  targetPrice: number,
  durationMinutes: number
): ShockEvent {
  const tickIntervalSec = TICK_INTERVAL_MS / 1000;
  const totalTicks = Math.max(1, Math.round((durationMinutes * 60) / tickIntervalSec));
  
  return {
    id: `shock_${Date.now()}_${++shockIdCounter}`,
    productId,
    targetPrice,
    durationMinutes,
    direction: targetPrice > currentPrice ? 'up' : 'down',
    startedAt: Date.now(),
    startPrice: currentPrice,
    ticksApplied: 0,
    totalTicks,
    isComplete: false,
  };
}

/** Get progress percentage of a shock event */
export function getShockProgress(event: ShockEvent): number {
  if (event.isComplete) return 100;
  return Math.min(100, (event.ticksApplied / event.totalTicks) * 100);
}

/** Get estimated time remaining in seconds */
export function getShockTimeRemaining(event: ShockEvent): number {
  if (event.isComplete) return 0;
  const remaining = event.totalTicks - event.ticksApplied;
  return remaining * (TICK_INTERVAL_MS / 1000);
}

/** Find active shock event for a product */
export function findActiveShock(events: ShockEvent[], productId: string): ShockEvent | null {
  return events.find(e => e.productId === productId && !e.isComplete) || null;
}
