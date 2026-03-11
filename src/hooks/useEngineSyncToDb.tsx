import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EngineState } from '@/lib/market-engine/types';
import { PRODUCTS } from '@/data/products';

interface ProductMapping {
  localId: string;
  dbId: string;
  symbol: string;
}

interface SyncStats {
  lastSyncAt: number | null;
  candlesSynced: number;
  pricesUpdated: number;
  errors: number;
}

/**
 * Syncs market engine candle data to the database (price_history + products tables).
 * Maps local product IDs to DB UUIDs by matching symbols.
 * Auto-seeds 60 historical candles on first enable so mini-charts display immediately.
 * Runs every `intervalMs` when enabled.
 */
export function useEngineSyncToDb(
  engines: Record<string, EngineState>,
  enabled: boolean,
  intervalMs: number = 5000
) {
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [stats, setStats] = useState<SyncStats>({
    lastSyncAt: null,
    candlesSynced: 0,
    pricesUpdated: 0,
    errors: 0,
  });
  const mappingsRef = useRef<ProductMapping[]>([]);
  const isSyncingRef = useRef(false);
  const hasSeededRef = useRef(false);

  // Fetch DB products and build mappings
  useEffect(() => {
    if (!enabled) return;

    const fetchMappings = async () => {
      const { data: dbProducts, error } = await supabase
        .from('products')
        .select('id, symbol, name')
        .eq('status', 'available');

      if (error || !dbProducts) {
        console.error('[EngineSync] Failed to fetch DB products:', error?.message);
        return;
      }

      const maps: ProductMapping[] = [];
      for (const local of PRODUCTS) {
        // Match by symbol (e.g., 'BTC/USDT')
        const dbMatch = dbProducts.find(
          (db) =>
            db.symbol?.toUpperCase() === local.symbol.toUpperCase() ||
            db.name?.toLowerCase() === local.name.toLowerCase()
        );
        if (dbMatch) {
          maps.push({
            localId: local.id,
            dbId: dbMatch.id,
            symbol: local.symbol,
          });
        }
      }

      console.log(`[EngineSync] Mapped ${maps.length}/${PRODUCTS.length} products to DB`);
      setMappings(maps);
      mappingsRef.current = maps;
    };

    fetchMappings();
  }, [enabled]);

  // Full reseed: delete old price_history and replace with ALL engine candles
  // This ensures user charts always match admin engine data exactly
  const seedHistoricalCandles = useCallback(async () => {
    if (hasSeededRef.current || mappingsRef.current.length === 0) return;
    setIsSeeding(true);

    let totalSeeded = 0;

    try {
      for (const mapping of mappingsRef.current) {
        const engine = engines[mapping.localId];
        if (!engine || engine.candles.length < 2) continue;

        // Delete all existing price_history for this product to avoid stale data
        const { error: deleteError } = await supabase
          .from('price_history')
          .delete()
          .eq('product_id', mapping.dbId);

        if (deleteError) {
          console.error(`[EngineSync:Seed] Delete error for ${mapping.symbol}:`, deleteError.message);
          continue;
        }

        // Seed ALL engine candles (up to last 1440 = 24h of 1M data)
        const candlesToSeed = engine.candles.slice(-1440);
        const now = new Date();
        
        // Insert in batches of 200 to avoid payload limits
        const BATCH_SIZE = 200;
        for (let batchStart = 0; batchStart < candlesToSeed.length; batchStart += BATCH_SIZE) {
          const batch = candlesToSeed.slice(batchStart, batchStart + BATCH_SIZE);
          const records = batch.map((c, i) => {
            const absoluteIndex = batchStart + i;
            const minutesAgo = candlesToSeed.length - 1 - absoluteIndex;
            const recordedAt = new Date(now.getTime() - minutesAgo * 60000);
            recordedAt.setSeconds(0, 0);
            return {
              product_id: mapping.dbId,
              recorded_at: recordedAt.toISOString(),
              open_price: c.open,
              high_price: c.high,
              low_price: c.low,
              close_price: c.close,
              volume: c.volume,
            };
          });

          const { error: insertError } = await supabase
            .from('price_history')
            .insert(records);

          if (insertError) {
            console.error(`[EngineSync:Seed] Insert error for ${mapping.symbol} batch ${batchStart}:`, insertError.message);
          } else {
            totalSeeded += records.length;
          }
        }

        console.log(`[EngineSync:Seed] Seeded ${candlesToSeed.length} candles for ${mapping.symbol}`);
      }

      if (totalSeeded > 0) {
        console.log(`[EngineSync:Seed] ✅ Full reseed: ${totalSeeded} total candles`);
      }
    } catch (err) {
      console.error('[EngineSync:Seed] Error:', err);
    } finally {
      setIsSeeding(false);
    }
  }, [engines]);

  // Sync function
  const syncToDb = useCallback(async () => {
    if (isSyncingRef.current || mappingsRef.current.length === 0) return;
    isSyncingRef.current = true;
    setIsSyncing(true);

    let candlesSynced = 0;
    let pricesUpdated = 0;
    let errors = 0;

    try {
      const now = new Date();
      const currentMinute = new Date(
        now.getFullYear(), now.getMonth(), now.getDate(),
        now.getHours(), now.getMinutes(), 0, 0
      );
      const recordedAt = currentMinute.toISOString();

      const priceHistoryRecords: Array<{
        product_id: string;
        recorded_at: string;
        open_price: number;
        high_price: number;
        low_price: number;
        close_price: number;
        volume: number;
      }> = [];

      const productUpdates: Array<{
        id: string;
        price: number;
        price_change: number;
        high_24h: number;
        low_24h: number;
      }> = [];

      for (const mapping of mappingsRef.current) {
        const engine = engines[mapping.localId];
        if (!engine || engine.candles.length === 0) continue;

        const lastCandle = engine.candles[engine.candles.length - 1];

        // Prepare price_history upsert
        priceHistoryRecords.push({
          product_id: mapping.dbId,
          recorded_at: recordedAt,
          open_price: lastCandle.open,
          high_price: lastCandle.high,
          low_price: lastCandle.low,
          close_price: lastCandle.close,
          volume: lastCandle.volume,
        });

        // Calculate 24h stats from candles
        const recentCandles = engine.candles.slice(-1440); // last 24h of 1M candles
        const high24h = Math.max(...recentCandles.map(c => c.high));
        const low24h = Math.min(...recentCandles.map(c => c.low));
        const firstPrice = recentCandles[0]?.open || lastCandle.close;
        const priceChange = firstPrice > 0
          ? ((lastCandle.close - firstPrice) / firstPrice) * 100
          : 0;

        productUpdates.push({
          id: mapping.dbId,
          price: lastCandle.close,
          price_change: Math.round(priceChange * 100) / 100,
          high_24h: high24h,
          low_24h: low24h,
        });
      }

      // Batch upsert price_history
      if (priceHistoryRecords.length > 0) {
        const { error: phError } = await supabase
          .from('price_history')
          .upsert(priceHistoryRecords, {
            onConflict: 'product_id,recorded_at',
            ignoreDuplicates: false,
          });

        if (phError) {
          console.error('[EngineSync] price_history upsert error:', phError.message);
          errors++;
        } else {
          candlesSynced = priceHistoryRecords.length;
        }
      }

      // Update products table (one by one since batch update isn't supported)
      for (const update of productUpdates) {
        const { error: pError } = await supabase
          .from('products')
          .update({
            price: update.price,
            price_change: update.price_change,
            high_24h: update.high_24h,
            low_24h: update.low_24h,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);

        if (pError) {
          console.error(`[EngineSync] product update error for ${update.id}:`, pError.message);
          errors++;
        } else {
          pricesUpdated++;
        }
      }

      setStats({
        lastSyncAt: Date.now(),
        candlesSynced,
        pricesUpdated,
        errors,
      });
    } catch (err) {
      console.error('[EngineSync] Sync error:', err);
      errors++;
      setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [engines]);

  // Auto-seed when mappings are ready, then start periodic sync
  useEffect(() => {
    if (!enabled || mappings.length === 0) return;

    // Seed first, then sync
    const initSync = async () => {
      await seedHistoricalCandles();
      syncToDb();
    };
    initSync();

    const interval = setInterval(syncToDb, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, mappings.length, intervalMs, syncToDb, seedHistoricalCandles]);

  // Reset seed flag when sync is disabled
  useEffect(() => {
    if (!enabled) {
      hasSeededRef.current = false;
    }
  }, [enabled]);

  return { mappings, isSyncing, isSeeding, stats, syncNow: syncToDb };
}
