import { describe, expect, it, vi } from 'vitest';
import { RetriesExhaustedError, retryOnConflict } from '../src/index.js';

describe('retryOnConflict', () => {
  it('stops as soon as the operation succeeds', async () => {
    const operation = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await retryOnConflict(operation, { baseDelayMs: 0 });

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts', async () => {
    const operation = vi.fn().mockResolvedValue(false);

    await expect(retryOnConflict(operation, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow(
      RetriesExhaustedError,
    );
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
