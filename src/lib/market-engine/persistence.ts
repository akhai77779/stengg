import {
  MarketEngineSnapshot,
  NamedSnapshot,
  SNAPSHOT_KEY,
  NAMED_SNAPSHOTS_KEY,
  MAX_NAMED_SNAPSHOTS,
  EngineState,
  ShockEvent,
  ProductScenario,
} from './types';

/**
 * Layer 3: Persistence
 * Save/restore full engine state to localStorage.
 * Supports auto-save (single active snapshot) and named snapshots.
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
      localStorage.removeItem(SNAPSHOT_KEY);
      return null;
    }
    
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - snapshot.savedAt > THIRTY_DAYS) {
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

// ─── Named Snapshots ─────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function listNamedSnapshots(): NamedSnapshot[] {
  try {
    const raw = localStorage.getItem(NAMED_SNAPSHOTS_KEY);
    if (!raw) return [];
    const list: NamedSnapshot[] = JSON.parse(raw);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveNamedSnapshot(
  name: string,
  engines: Record<string, EngineState>,
  shockEvents: ShockEvent[],
  scenarios: Record<string, ProductScenario>
): NamedSnapshot | null {
  try {
    const list = listNamedSnapshots();
    if (list.length >= MAX_NAMED_SNAPSHOTS) {
      // Remove oldest
      list.pop();
    }

    const named: NamedSnapshot = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      snapshot: {
        version: CURRENT_VERSION,
        savedAt: Date.now(),
        engines,
        shockEvents: shockEvents.filter(e => !e.isComplete),
        scenarios,
      },
    };

    list.unshift(named);
    localStorage.setItem(NAMED_SNAPSHOTS_KEY, JSON.stringify(list));
    return named;
  } catch (e) {
    console.warn('Failed to save named snapshot:', e);
    return null;
  }
}

export function loadNamedSnapshot(id: string): MarketEngineSnapshot | null {
  const list = listNamedSnapshots();
  const found = list.find(s => s.id === id);
  return found?.snapshot || null;
}

export function deleteNamedSnapshot(id: string): void {
  try {
    const list = listNamedSnapshots().filter(s => s.id !== id);
    localStorage.setItem(NAMED_SNAPSHOTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to delete named snapshot:', e);
  }
}

export function renameNamedSnapshot(id: string, newName: string): void {
  try {
    const list = listNamedSnapshots().map(s =>
      s.id === id ? { ...s, name: newName } : s
    );
    localStorage.setItem(NAMED_SNAPSHOTS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to rename snapshot:', e);
  }
}
