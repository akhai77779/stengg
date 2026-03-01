import { MarketEngineSnapshot, SNAPSHOT_KEY, EngineState, ShockEvent, ProductScenario } from './types';

/**
 * Layer 3: Persistence
 * Save/restore full engine state to localStorage.
 * Handles versioning and migration.
 */

const CURRENT_VERSION = 2;

export function saveSnapshot(
  engines: Record<string, EngineState>,
  shockEvents: ShockEvent[],
  scenarios: Record<string, ProductScenario>
): void {
  try {
    const snapshot: MarketEngineSnapshot = {
      version: CURRENT_VERSION,
      savedAt: Date.now(),
      engines,
      shockEvents: shockEvents.filter(e => !e.isComplete),
      scenarios,
    };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Failed to save market engine snapshot:', e);
  }
}

export function loadSnapshot(): MarketEngineSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    
    const snapshot: MarketEngineSnapshot = JSON.parse(raw);
    
    if (snapshot.version !== CURRENT_VERSION) {
      // Version mismatch - discard old data
      localStorage.removeItem(SNAPSHOT_KEY);
      return null;
    }
    
    // Check staleness - if older than 1 hour, discard
    const ONE_HOUR = 60 * 60 * 1000;
    if (Date.now() - snapshot.savedAt > ONE_HOUR) {
      localStorage.removeItem(SNAPSHOT_KEY);
      return null;
    }
    
    return snapshot;
  } catch (e) {
    console.warn('Failed to load market engine snapshot:', e);
    localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }
}

export function clearSnapshot(): void {
  localStorage.removeItem(SNAPSHOT_KEY);
}
