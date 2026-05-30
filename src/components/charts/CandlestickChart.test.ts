import { describe, it, expect } from 'vitest';
import { computeNextVisibleRange } from './CandlestickChart';

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