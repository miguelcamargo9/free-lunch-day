export interface RetryOptions {
  readonly attempts?: number;
  readonly baseDelayMs?: number;
  readonly random?: () => number;
}

export class RetriesExhaustedError extends Error {}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Only for optimistic-concurrency races that settle in milliseconds; business waits use SQS delays.
export async function retryOnConflict(
  operation: () => Promise<boolean>,
  { attempts = 8, baseDelayMs = 10, random = Math.random }: RetryOptions = {},
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await operation()) return;
    await pause(random() * baseDelayMs * 2 ** attempt);
  }
  throw new RetriesExhaustedError(`Operation still conflicting after ${attempts} attempts`);
}
