import type { Ingredient } from '@lunch/contracts';
import type {
  FarmersMarket,
  PurchaseJobQueue,
  PurchaseRepository,
} from '../src/application/ports.js';
import type { Purchase, PurchaseJob, PurchaseRequest } from '../src/domain/purchase.js';

export class ScriptedFarmersMarket implements FarmersMarket {
  readonly calls: Ingredient[] = [];

  constructor(private readonly sales: number[]) {}

  buy(ingredient: Ingredient): Promise<number> {
    this.calls.push(ingredient);
    return Promise.resolve(this.sales.shift() ?? 0);
  }
}

export class RecordingJobQueue implements PurchaseJobQueue {
  readonly jobs: { job: PurchaseJob; delaySeconds: number }[] = [];

  enqueue(job: PurchaseJob, delaySeconds: number): Promise<void> {
    this.jobs.push({ job, delaySeconds });
    return Promise.resolve();
  }
}

export class InMemoryPurchaseRepository implements PurchaseRepository {
  readonly requests = new Map<string, PurchaseRequest>();
  readonly purchases = new Map<string, Purchase>();

  openRequest(request: PurchaseRequest): Promise<PurchaseRequest> {
    const stored = this.requests.get(request.requestId);
    if (stored) return Promise.resolve(stored);
    this.requests.set(request.requestId, request);
    return Promise.resolve(request);
  }

  findRequest(requestId: string): Promise<PurchaseRequest | undefined> {
    return Promise.resolve(this.requests.get(requestId));
  }

  findPurchase(purchaseId: string): Promise<Purchase | undefined> {
    return Promise.resolve(this.purchases.get(purchaseId));
  }

  recordPurchase(request: PurchaseRequest, purchase: Purchase): Promise<boolean> {
    const stored = this.requests.get(request.requestId);
    if (stored?.attempts !== request.attempts || this.purchases.has(purchase.purchaseId)) {
      return Promise.resolve(false);
    }
    this.requests.set(request.requestId, {
      ...stored,
      attempts: purchase.attempt,
      purchased: stored.purchased + purchase.quantitySold,
    });
    this.purchases.set(purchase.purchaseId, purchase);
    return Promise.resolve(true);
  }

  markScheduled(requestId: string, attempt: number): Promise<void> {
    const stored = this.requests.get(requestId);
    if (stored && stored.scheduledAttempt < attempt) {
      this.requests.set(requestId, { ...stored, scheduledAttempt: attempt });
    }
    return Promise.resolve();
  }

  listRecentPurchases(limit: number): Promise<Purchase[]> {
    const newestFirst = [...this.purchases.values()].sort((a, b) => b.at.localeCompare(a.at));
    return Promise.resolve(newestFirst.slice(0, limit));
  }
}
