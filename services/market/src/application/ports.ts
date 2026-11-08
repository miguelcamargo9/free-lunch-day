import type { Ingredient } from '@lunch/contracts';
import type { Purchase, PurchaseJob, PurchaseRequest } from '../domain/purchase.js';

export interface PurchaseRepository {
  openRequest(request: PurchaseRequest): Promise<PurchaseRequest>;
  findRequest(requestId: string): Promise<PurchaseRequest | undefined>;
  findPurchase(purchaseId: string): Promise<Purchase | undefined>;
  recordPurchase(request: PurchaseRequest, purchase: Purchase): Promise<boolean>;
  markScheduled(requestId: string, attempt: number): Promise<void>;
  listRecentPurchases(limit: number): Promise<Purchase[]>;
}

export interface FarmersMarket {
  buy(ingredient: Ingredient): Promise<number>;
}

export interface PurchaseJobQueue {
  enqueue(job: PurchaseJob, delaySeconds: number): Promise<void>;
}
