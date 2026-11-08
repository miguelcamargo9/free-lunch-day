import type { Ingredient } from '@lunch/contracts';

export const MAX_RETRY_DELAY_SECONDS = 60;

export interface PurchaseRequest {
  readonly requestId: string;
  readonly dishId: string;
  readonly ingredient: Ingredient;
  readonly requested: number;
  readonly purchased: number;
  readonly attempts: number;
  readonly scheduledAttempt: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Purchase {
  readonly purchaseId: string;
  readonly requestId: string;
  readonly dishId: string;
  readonly ingredient: Ingredient;
  readonly requested: number;
  readonly quantitySold: number;
  readonly attempt: number;
  readonly at: string;
}

export interface PurchaseJob {
  readonly requestId: string;
  readonly attempt: number;
}

export function remainingOf(request: PurchaseRequest): number {
  return request.requested - request.purchased;
}

export function leftoverAfter(purchase: Purchase): number {
  return Math.max(0, purchase.requested - purchase.quantitySold);
}

// Exponential backoff with equal jitter: half the ceiling is fixed, half is random.
export function retryDelaySeconds(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_RETRY_DELAY_SECONDS, 2 ** attempt);
  return Math.ceil(ceiling / 2 + (random() * ceiling) / 2);
}
