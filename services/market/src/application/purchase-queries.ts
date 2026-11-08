import type { Purchase } from '../domain/purchase.js';
import type { PurchaseRepository } from './ports.js';

export const RECENT_PURCHASES_LIMIT = 50;

export class PurchaseQueries {
  constructor(private readonly repository: PurchaseRepository) {}

  listRecent(): Promise<Purchase[]> {
    return this.repository.listRecentPurchases(RECENT_PURCHASES_LIMIT);
  }
}
