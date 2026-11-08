import type { Ingredient } from '@lunch/contracts';
import type { InventoryRepository } from './ports.js';

export class InventoryQueries {
  constructor(private readonly repository: InventoryRepository) {}

  listStock(): Promise<Record<Ingredient, number>> {
    return this.repository.listStock();
  }
}
