import { countByStatus, type OrderSummary } from '../domain/order.js';
import { RECIPES, type Recipe } from '../domain/recipes.js';
import type { OrderRepository } from './ports.js';

export class OrderQueries {
  constructor(private readonly repository: OrderRepository) {}

  async findOrder(orderId: string): Promise<OrderSummary | undefined> {
    const [order, statuses] = await Promise.all([
      this.repository.findOrder(orderId),
      this.repository.listDishStatuses(orderId),
    ]);
    return order && { ...order, counts: countByStatus(statuses) };
  }

  listRecipes(): readonly Recipe[] {
    return RECIPES;
  }
}
