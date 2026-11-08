import { describe, expect, it } from 'vitest';
import { chunk, mapWithConcurrency } from '../src/index.js';

describe('chunk', () => {
  it('splits into fixed-size chunks with a smaller tail', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('rejects a size below 1', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps input order and never exceeds the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapWithConcurrency([30, 10, 20, 0, 5], 2, async (delay, index) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, delay));
      inFlight--;
      return index;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });
});
