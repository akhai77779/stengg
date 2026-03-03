import { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Candle } from '@/types/trading';
import { PRODUCTS } from '@/data/products';
import {
  EngineState,
  ProductScenario,
  ShockEvent,
  TICK_INTERVAL_MS,
} from '@/lib/market-engine/types';
import { createScenariosFromProducts } from '@/lib/market-engine/scenarios';
import { createEngineState, applyTick } from '@/lib/market-engine/engine';
import {
  saveSnapshot, loadSnapshot, clearSnapshot,
  listNamedSnapshots, saveNamedSnapshot, loadNamedSnapshot,
  deleteNamedSnapshot, renameNamedSnapshot,
} from '@/lib/market-engine/persistence';
import { NamedSnapshot } from '@/lib/market-engine/types';
import { createShockEvent, findActiveShock } from '@/lib/market-engine/shockEvents';

/**
 * Hook that orchestrates all 4 layers of the market engine.
 * Provides: engine states, shock events, scenario controls, persistence.
 */
export function useMarketEngine() {
  const [engines, setEngines] = useState<Record<string, EngineState>>({});
  const [scenarios, setScenarios] = useState<Record<string, ProductScenario>>({});
  const [shockEvents, setShockEvents] = useState<ShockEvent[]>([]);
  const [namedSnapshots, setNamedSnapshots] = useState<NamedSnapshot[]>([]);
  const [isReady, setIsReady] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setInterval>>();

  // Initialize: try restore from persistence, else create fresh
  useEffect(() => {
    const snapshot = loadSnapshot();
    const products = PRODUCTS;

    if (snapshot) {
      // Restore from snapshot, but ensure all products exist
      const restoredEngines: Record<string, EngineState> = {};
      const restoredScenarios: Record<string, ProductScenario> = {};
      const defaultScenarios = createScenariosFromProducts(products);

      products.forEach(p => {
        if (snapshot.engines[p.id] && snapshot.engines[p.id].candles.length > 0) {
          restoredEngines[p.id] = snapshot.engines[p.id];
        } else {
          restoredEngines[p.id] = createEngineState(defaultScenarios[p.id]);
        }
        restoredScenarios[p.id] = snapshot.scenarios[p.id] || defaultScenarios[p.id];
      });

      setEngines(restoredEngines);
      setScenarios(restoredScenarios);
      setShockEvents(snapshot.shockEvents || []);
    } else {
      // Fresh start
      const defaultScenarios = createScenariosFromProducts(products);
      const freshEngines: Record<string, EngineState> = {};
      products.forEach(p => {
        freshEngines[p.id] = createEngineState(defaultScenarios[p.id]);
      });
      setEngines(freshEngines);
      setScenarios(defaultScenarios);
    }

    setNamedSnapshots(listNamedSnapshots());
    setIsReady(true);
  }, []);

  // Tick loop: update all products every TICK_INTERVAL_MS
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      setEngines(prev => {
        const next: Record<string, EngineState> = {};
        let newShocks = [...shockEvents];
        let shocksChanged = false;

        Object.keys(prev).forEach(pid => {
          const state = prev[pid];
          const scenario = scenarios[pid];
          if (!scenario) {
            next[pid] = state;
            return;
          }

          const activeShock = findActiveShock(newShocks, pid);
          const { newState, updatedShock } = applyTick(state, scenario, activeShock);
          next[pid] = newState;

          if (updatedShock && activeShock) {
            shocksChanged = true;
            newShocks = newShocks.map(s => s.id === activeShock.id ? updatedShock : s);
          }
        });

        if (shocksChanged) {
          setShockEvents(newShocks);
        }

        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isReady, scenarios, shockEvents]);

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!isReady) return;
    
    saveTimerRef.current = setInterval(() => {
      saveSnapshot(engines, shockEvents, scenarios);
    }, 10000);

    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  }, [isReady, engines, shockEvents, scenarios]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (isReady) {
        saveSnapshot(engines, shockEvents, scenarios);
      }
    };
  }, [isReady, engines, shockEvents, scenarios]);

  // Actions
  const addShockEvent = useCallback((
    productId: string,
    targetPrice: number,
    durationMinutes: number
  ) => {
    const engine = engines[productId];
    if (!engine || engine.candles.length === 0) return;

    const currentPrice = engine.candles[engine.candles.length - 1].close;
    const event = createShockEvent(productId, currentPrice, targetPrice, durationMinutes);

    setShockEvents(prev => {
      // Remove any existing active shock for this product
      const filtered = prev.filter(e => e.productId !== productId || e.isComplete);
      return [...filtered, event];
    });
  }, [engines]);

  const cancelShockEvent = useCallback((productId: string) => {
    setShockEvents(prev =>
      prev.map(e =>
        e.productId === productId && !e.isComplete
          ? { ...e, isComplete: true }
          : e
      )
    );
  }, []);

  const updateScenario = useCallback((productId: string, updates: Partial<ProductScenario>) => {
    setScenarios(prev => ({
      ...prev,
      [productId]: { ...prev[productId], ...updates },
    }));
  }, []);

  const getCandles = useCallback((productId: string): Candle[] => {
    return engines[productId]?.candles || [];
  }, [engines]);

  const getCurrentPrice = useCallback((productId: string): number => {
    const candles = engines[productId]?.candles;
    return candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
  }, [engines]);

  const getActiveShock = useCallback((productId: string): ShockEvent | null => {
    return findActiveShock(shockEvents, productId);
  }, [shockEvents]);

  const resetEngine = useCallback(() => {
    clearSnapshot();
    const products = PRODUCTS;
    const defaultScenarios = createScenariosFromProducts(products);
    const freshEngines: Record<string, EngineState> = {};
    products.forEach(p => {
      freshEngines[p.id] = createEngineState(defaultScenarios[p.id]);
    });
    setEngines(freshEngines);
    setScenarios(defaultScenarios);
    setShockEvents([]);
  }, []);

  // ─── Named Snapshot Actions ─────────────────────────────────

  const saveNewSnapshot = useCallback((name: string) => {
    const result = saveNamedSnapshot(name, engines, shockEvents, scenarios);
    if (result) {
      setNamedSnapshots(listNamedSnapshots());
    }
    return result;
  }, [engines, shockEvents, scenarios]);

  const restoreSnapshot = useCallback((id: string) => {
    const snapshot = loadNamedSnapshot(id);
    if (!snapshot) return false;

    const products = PRODUCTS;
    const defaultScenarios = createScenariosFromProducts(products);
    const restoredEngines: Record<string, EngineState> = {};
    const restoredScenarios: Record<string, ProductScenario> = {};

    products.forEach(p => {
      if (snapshot.engines[p.id] && snapshot.engines[p.id].candles.length > 0) {
        restoredEngines[p.id] = snapshot.engines[p.id];
      } else {
        restoredEngines[p.id] = createEngineState(defaultScenarios[p.id]);
      }
      restoredScenarios[p.id] = snapshot.scenarios[p.id] || defaultScenarios[p.id];
    });

    setEngines(restoredEngines);
    setScenarios(restoredScenarios);
    setShockEvents(snapshot.shockEvents || []);
    return true;
  }, []);

  const removeSnapshot = useCallback((id: string) => {
    deleteNamedSnapshot(id);
    setNamedSnapshots(listNamedSnapshots());
  }, []);

  const renameSnapshot = useCallback((id: string, newName: string) => {
    renameNamedSnapshot(id, newName);
    setNamedSnapshots(listNamedSnapshots());
  }, []);

  return {
    products: PRODUCTS,
    engines,
    scenarios,
    shockEvents,
    namedSnapshots,
    isReady,
    getCandles,
    getCurrentPrice,
    getActiveShock,
    addShockEvent,
    cancelShockEvent,
    updateScenario,
    resetEngine,
    saveNewSnapshot,
    restoreSnapshot,
    removeSnapshot,
    renameSnapshot,
  };
}
