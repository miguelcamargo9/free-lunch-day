import type { Order } from '../domain/order.js';
import { RECIPES, type Recipe } from '../domain/recipes.js';
import type { OrderRepository } from './ports.js';

export class OrderQueries {
  constructor(private readonly repository: OrderRepository) {}

  findOrder(orderId: string): Promise<Order | undefined> {
    return this.repository.findOrder(orderId);
  }

  listRecipes(): readonly Recipe[] {
    return RECIPES;
  }
}
