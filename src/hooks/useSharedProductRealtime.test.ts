import { describe, it, expect } from 'vitest';
import { vi, beforeEach } from 'vitest';
import {
  isValidProductId,
  aggregateOHLCData,
  cacheKey,
  __getSharedProductCache,
  __readSharedProductCacheEntry,
  __resetSharedProductCache,
  __writeSharedProductCacheEntry,
} from './useSharedProductRealtime';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({}), channel: () => ({}), removeChannel: () => {} },
}));

describe('isValidProductId', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidProductId('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isValidProductId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
  });

  it('rejects invalid / empty / non-UUID strings', () => {
    expect(isValidProductId('')).toBe(false);
    expect(isValidProductId(undefined)).toBe(false);
    expect(isValidProductId(null as any)).toBe(false);
    expect(isValidProductId('not-a-uuid')).toBe(false);
    expect(isValidProductId('123')).toBe(false);
    // SQL-injection-ish input must not be considered valid for filter building
    expect(isValidProductId("11111111-1111-1111-1111-111111111111' OR '1'='1")).toBe(false);
  });
});

describe('aggregateOHLCData', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateOHLCData([], '1m')).toEqual([]);
  });

  it('buckets multiple rows into one candle for the same timeframe', () => {
    const base = new Date('2024-01-01T00:00:10Z').toISOString();
    const mid = new Date('2024-01-01T00:00:30Z').toISOString();
    const end = new Date('2024-01-01T00:00:55Z').toISOString();
    const result = aggregateOHLCData(
      [
        { recorded_at: base, open_price: 10, high_price: 12, low_price: 9, close_price: 11 },
        { recorded_at: mid, open_price: 11, high_price: 15, low_price: 8, close_price: 14 },
        { recorded_at: end, open_price: 14, high_price: 14, low_price: 13, close_price: 13 },
      ],
      '1m'
    );
    expect(result).toHaveLength(1);
    expect(result[0].open).toBe(10);
    expect(result[0].high).toBe(15);
    expect(result[0].low).toBe(8);
    expect(result[0].close).toBe(13);
  });

  it('skips rows with non-finite timestamps', () => {
    const result = aggregateOHLCData(
      [
        { recorded_at: 'not-a-date', open_price: 1, high_price: 1, low_price: 1, close_price: 1 },
        { recorded_at: '2024-01-01T00:00:00Z', open_price: 5, high_price: 5, low_price: 5, close_price: 5 },
      ],
      '1m'
    );
    expect(result).toHaveLength(1);
    expect(result[0].close).toBe(5);
  });
});

describe('aggregateOHLCData edge values', () => {
  it('keeps real bucket values even if a later row has lower high', () => {
    const base = '2024-01-01T00:00:10Z';
    const later = '2024-01-01T00:00:50Z';
    const result = aggregateOHLCData(
      [
        { recorded_at: base, open_price: 10, high_price: 20, low_price: 5, close_price: 12 },
        { recorded_at: later, open_price: 12, high_price: 15, low_price: 8, close_price: 13 },
      ],
      '1m'
    );
    expect(result).toHaveLength(1);
    expect(result[0].high).toBe(20);
    expect(result[0].low).toBe(5);
    expect(result[0].close).toBe(13);
  });
});

describe('shared product cacheKey', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const idB = '22222222-2222-2222-2222-222222222222';

  it('is independent of timeframe', () => {
    expect(cacheKey(id, '1m')).toBe(cacheKey(id, '5m'));
    expect(cacheKey(id, '5m')).toBe(cacheKey(id, '1h'));
    expect(cacheKey(id, '1d')).toBe(cacheKey(id));
  });

  it('differs across products', () => {
    expect(cacheKey(id)).not.toBe(cacheKey(idB));
  });
});

describe('shared product cache storage', () => {
  const id = '33333333-3333-3333-3333-333333333333';
  const idB = '44444444-4444-4444-4444-444444444444';
  const sampleEntry = {
    rows: [{ recorded_at: '2024-01-01T00:00:00Z', open_price: 1, high_price: 2, low_price: 0.5, close_price: 1.5 }],
    product: null,
    anchorPrice: 1.5,
    latestRealRowAt: '2024-01-01T00:00:00Z',
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    __resetSharedProductCache();
    sessionStorage.clear();
  });

  it('writes via 1m key and reads via 5m key (same product)', () => {
    const cache = __getSharedProductCache();
    cache.set(cacheKey(id, '1m'), sampleEntry);
    const read = cache.get(cacheKey(id, '5m'));
    expect(read).toBeDefined();
    expect(read?.anchorPrice).toBe(1.5);
  });

  it('does not duplicate entries when timeframe changes', () => {
    const cache = __getSharedProductCache();
    cache.set(cacheKey(id, '1m'), sampleEntry);
    cache.set(cacheKey(id, '5m'), sampleEntry);
    cache.set(cacheKey(id, '1h'), sampleEntry);
    expect(cache.size).toBe(1);
  });

  it('keeps separate entries per product', () => {
    const cache = __getSharedProductCache();
    cache.set(cacheKey(id), sampleEntry);
    cache.set(cacheKey(idB), sampleEntry);
    expect(cache.size).toBe(2);
  });

  it('restores cache from sessionStorage after memory cache is cleared', () => {
    __writeSharedProductCacheEntry(cacheKey(id), sampleEntry);
    __getSharedProductCache().clear();
    const restored = __readSharedProductCacheEntry(cacheKey(id, '1h'));
    expect(restored?.rows).toHaveLength(1);
    expect(restored?.anchorPrice).toBe(1.5);
  });
});
