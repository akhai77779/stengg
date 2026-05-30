import { describe, it, expect } from 'vitest';
import {
  chartVisibleRangeStorageKey,
  computeNextVisibleRange,
  readStoredVisibleRange,
  writeStoredVisibleRange,
} from './CandlestickChart';

describe('computeNextVisibleRange — reset mode', () => {
  it('snaps to the last 60 candles when plenty of data', () => {
    expect(computeNextVisibleRange(null, 200, 'reset')).toEqual({ from: 140, to: 202 });
  });

  it('falls back to from=0 when total < window', () => {
    expect(computeNextVisibleRange(null, 10, 'reset')).toEqual({ from: 0, to: 12 });
  });

  it('returns null for empty dataset', () => {
    expect(computeNextVisibleRange(null, 0, 'reset')).toBeNull();
  });

  it('respects custom resetWindow', () => {
    expect(computeNextVisibleRange(null, 200, 'reset', 30)).toEqual({ from: 170, to: 202 });
  });
});

describe('computeNextVisibleRange — preserve mode', () => {
  it('keeps the previous range when it still fits', () => {
    expect(
      computeNextVisibleRange({ from: 100, to: 160 }, 180, 'preserve'),
    ).toEqual({ from: 100, to: 160 });
  });

  it('clamps `to` to new total and preserves width when dataset shrank', () => {
    const next = computeNextVisibleRange({ from: 100, to: 160 }, 120, 'preserve');
    expect(next).toEqual({ from: 62, to: 122 });
    expect(next!.to - next!.from).toBe(60);
  });

  it('floors `from` at 0 when width would push it negative', () => {
    const next = computeNextVisibleRange({ from: 5, to: 80 }, 20, 'preserve');
    expect(next?.from).toBe(0);
    expect(next?.to).toBe(22);
  });

  it('returns null when no previous range exists', () => {
    expect(computeNextVisibleRange(null, 100, 'preserve')).toBeNull();
  });
});

describe('visible range session persistence', () => {
  const key = 'product-a::30m';

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and restores a visible range by key', () => {
    writeStoredVisibleRange(key, { from: 20, to: 80 });
    expect(sessionStorage.getItem(chartVisibleRangeStorageKey(key))).toBe(JSON.stringify({ from: 20, to: 80 }));
    expect(readStoredVisibleRange(key, 100)).toEqual({ from: 20, to: 80 });
  });

  it('clamps restored range into the new dataset size', () => {
    writeStoredVisibleRange(key, { from: 100, to: 160 });
    expect(readStoredVisibleRange(key, 120)).toEqual({ from: 62, to: 122 });
  });

  it('keeps timeframe ranges isolated', () => {
    writeStoredVisibleRange('product-a::1m', { from: 1, to: 20 });
    writeStoredVisibleRange('product-a::1h', { from: 40, to: 90 });
    expect(readStoredVisibleRange('product-a::1m', 100)).toEqual({ from: 1, to: 20 });
    expect(readStoredVisibleRange('product-a::1h', 100)).toEqual({ from: 40, to: 90 });
  });
});