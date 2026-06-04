import { useState, useEffect, useCallback, useRef } from "react";
import { Product, Candle } from "@/types/trading";
import { PRODUCTS } from "@/data/products";
import { EngineState, ProductScenario, ShockEvent, TICK_INTERVAL_MS } from "@/lib/market-engine/types";
import { createScenariosFromProducts } from "@/lib/market-engine/scenarios";
import { createEngineState, applyTick } from "@/lib/market-engine/engine";
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshot,
  listNamedSnapshots,
  saveNamedSnapshot,
  loadNamedSnapshot,
  deleteNamedSnapshot,
  renameNamedSnapshot,
} from "@/lib/market-engine/persistence";
import { NamedSnapshot } from "@/lib/market-engine/types";
import { createShockEvent, findActiveShock } from "@/lib/market-engine/shockEvents";

/**
 * Hook that orchestrates all 4 layers of the market engine.
 *
 * FIX: Stale closure bug — the tick interval previously re-created itself on
 * every shockEvents/scenarios state change, causing candle gaps and missed
 * shock events. Now we store shockEvents and scenarios in refs that are kept
 * in sync with state, so the single stable interval always reads fresh values.
 */
export function useMarketEngine() {
  const [engines, setEngines] = useState<Record<string, EngineState>>({});
  const [scenarios, setScenarios] = useState<Record<string, ProductScenario>>({});
  const [shockEvents, setShockEvents] = useState<ShockEvent[]>([]);
  const [namedSnapshots, setNamedSnapshots] = useState<NamedSnapshot[]>([]);
  const [isReady, setIsReady] = useState(false);

  // ── Refs that mirror state for use inside the stable tick interval ────────
  // This is the core fix: the interval never closes over stale state.
  const scenariosRef = useRef<Record<string, ProductScenario>>({});
  const shockEventsRef = useRef<ShockEvent[]>([]);
  const enginesRef = useRef<Record<string, EngineState>>({});

  // Keep refs in sync whenever state changes
  useEffect(() => {
    scenariosRef.current = scenarios;
  }, [scenarios]);
  useEffect(() => {
    shockEventsRef.current = shockEvents;
  }, [shockEvents]);
  useEffect(() => {
    enginesRef.current = engines;
  }, [engines]);

  // ── Initialize: restore from persistence or create fresh ─────────────────
  useEffect(() => {
    const snapshot = loadSnapshot();
    const products = PRODUCTS;

    if (snapshot) {
      const restoredEngines: Record<string, EngineState> = {};
      const restoredScenarios: Record<string, ProductScenario> = {};
      const defaultScenarios = createScenariosFromProducts(products);

      products.forEach((p) => {
        const saved = snapshot.engines[p.id];
        const lastClose = saved?.candles?.[saved.candles.length - 1]?.close ?? 0;
        const base = p.basePrice || 1;
        const drifted = lastClose <= base * 0.3 || lastClose >= base * 3;
        if (saved && saved.candles.length > 0 && !drifted) {
          // Ensure restored state has momentum fields (may be missing from old snapshots)
          restoredEngines[p.id] = {
            momentum: 0,
            consecutiveTicks: 0,
            ...saved,
          };
        } else {
          restoredEngines[p.id] = createEngineState(defaultScenarios[p.id]);
        }
        restoredScenarios[p.id] = snapshot.scenarios[p.id] || defaultScenarios[p.id];
      });

      setEngines(restoredEngines);
      setScenarios(restoredScenarios);
      setShockEvents(snapshot.shockEvents || []);
    } else {
      const defaultScenarios = createScenariosFromProducts(products);
      const freshEngines: Record<string, EngineState> = {};
      products.forEach((p) => {
        freshEngines[p.id] = createEngineState(defaultScenarios[p.id]);
      });
      setEngines(freshEngines);
      setScenarios(defaultScenarios);
    }

    setNamedSnapshots(listNamedSnapshots());
    setIsReady(true);
  }, []);

  // ── Tick loop: STABLE interval — reads from refs, never re-creates ────────
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      // Always read the freshest values via refs — zero stale closure risk
      const currentScenarios = scenariosRef.current;
      const currentShocks = shockEventsRef.current;

      setEngines((prev) => {
        const next: Record<string, EngineState> = {};
        let newShocks = currentShocks;
        let shocksChanged = false;

        Object.keys(prev).forEach((pid) => {
          const state = prev[pid];
          const scenario = currentScenarios[pid];
          if (!scenario) {
            next[pid] = state;
            return;
          }

          const activeShock = findActiveShock(newShocks, pid);
          const { newState, updatedShock } = applyTick(state, scenario, activeShock);
          next[pid] = newState;

          if (updatedShock && activeShock && updatedShock !== activeShock) {
            shocksChanged = true;
            newShocks = newShocks.map((s) => (s.id === activeShock.id ? updatedShock : s));
          }
        });

        if (shocksChanged) {
          // Update both state and ref immediately to avoid a lag cycle
          shockEventsRef.current = newShocks;
          setShockEvents(newShocks);
        }

        return next;
      });
    }, TICK_INTERVAL_MS);

    // Single stable interval — only torn down when isReady changes (i.e. never
    // after init). No dependency on shockEvents or scenarios.
    return () => clearInterval(interval);
  }, [isReady]);

  // ── Auto-save every 10 seconds (reads from refs — no re-create needed) ───
  useEffect(() => {
    if (!isReady) return;

    const saveTimer = setInterval(() => {
      saveSnapshot(enginesRef.current, shockEventsRef.current, scenariosRef.current);
    }, 10000);

    return () => clearInterval(saveTimer);
  }, [isReady]);

  // ── Save on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (isReady) {
        saveSnapshot(enginesRef.current, shockEventsRef.current, scenariosRef.current);
      }
    };
  }, [isReady]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const addShockEvent = useCallback((productId: string, targetPrice: number, durationMinutes: number) => {
    const engine = enginesRef.current[productId];
    if (!engine || engine.candles.length === 0) return;

    const currentPrice = engine.candles[engine.candles.length - 1].close;
    const event = createShockEvent(productId, currentPrice, targetPrice, durationMinutes);

    setShockEvents((prev) => {
      const filtered = prev.filter((e) => e.productId !== productId || e.isComplete);
      const updated = [...filtered, event];
      shockEventsRef.current = updated;
      return updated;
    });
  }, []);

  const cancelShockEvent = useCallback((productId: string) => {
    setShockEvents((prev) => {
      const updated = prev.map((e) => (e.productId === productId && !e.isComplete ? { ...e, isComplete: true } : e));
      shockEventsRef.current = updated;
      return updated;
    });
  }, []);

  const updateScenario = useCallback((productId: string, updates: Partial<ProductScenario>) => {
    setScenarios((prev) => {
      const updated = {
        ...prev,
        [productId]: { ...prev[productId], ...updates },
      };
      scenariosRef.current = updated;
      return updated;
    });
  }, []);

  const getCandles = useCallback((productId: string): Candle[] => {
    return enginesRef.current[productId]?.candles || [];
  }, []);

  const getCurrentPrice = useCallback((productId: string): number => {
    const candles = enginesRef.current[productId]?.candles;
    return candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
  }, []);

  const getActiveShock = useCallback((productId: string): ShockEvent | null => {
    return findActiveShock(shockEventsRef.current, productId);
  }, []);

  const resetEngine = useCallback(() => {
    clearSnapshot();
    const products = PRODUCTS;
    const defaultScenarios = createScenariosFromProducts(products);
    const freshEngines: Record<string, EngineState> = {};
    products.forEach((p) => {
      freshEngines[p.id] = createEngineState(defaultScenarios[p.id]);
    });
    setEngines(freshEngines);
    setScenarios(defaultScenarios);
    setShockEvents([]);
    enginesRef.current = freshEngines;
    scenariosRef.current = defaultScenarios;
    shockEventsRef.current = [];
  }, []);

  // ── Named Snapshot Actions ────────────────────────────────────────────────

  const saveNewSnapshot = useCallback((name: string) => {
    const result = saveNamedSnapshot(name, enginesRef.current, shockEventsRef.current, scenariosRef.current);
    if (result) {
      setNamedSnapshots(listNamedSnapshots());
    }
    return result;
  }, []);

  const restoreSnapshot = useCallback((id: string) => {
    const snapshot = loadNamedSnapshot(id);
    if (!snapshot) return false;

    const products = PRODUCTS;
    const defaultScenarios = createScenariosFromProducts(products);
    const restoredEngines: Record<string, EngineState> = {};
    const restoredScenarios: Record<string, ProductScenario> = {};

    products.forEach((p) => {
      if (snapshot.engines[p.id] && snapshot.engines[p.id].candles.length > 0) {
        restoredEngines[p.id] = {
          momentum: 0,
          consecutiveTicks: 0,
          ...snapshot.engines[p.id],
        };
      } else {
        restoredEngines[p.id] = createEngineState(defaultScenarios[p.id]);
      }
      restoredScenarios[p.id] = snapshot.scenarios[p.id] || defaultScenarios[p.id];
    });

    setEngines(restoredEngines);
    setScenarios(restoredScenarios);
    setShockEvents(snapshot.shockEvents || []);
    enginesRef.current = restoredEngines;
    scenariosRef.current = restoredScenarios;
    shockEventsRef.current = snapshot.shockEvents || [];
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
