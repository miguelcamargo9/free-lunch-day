import type { DishStatus } from '@lunch/contracts';
import type { OrderRepository } from '../src/application/ports.js';
import type { Dish } from '../src/domain/dish.js';
import type { Order } from '../src/domain/order.js';

export class InMemoryOrderRepository implements OrderRepository {
  readonly orders = new Map<string, Order>();
  readonly dishes = new Map<string, Dish>();

  saveOrder(order: Order): Promise<void> {
    if (this.orders.has(order.orderId)) return Promise.reject(new Error('duplicate order'));
    this.orders.set(order.orderId, structuredClone(order));
    return Promise.resolve();
  }

  findOrder(orderId: string): Promise<Order | undefined> {
    return Promise.resolve(this.orders.get(orderId));
  }

  createDish(dish: Dish): Promise<Dish> {
    const stored = this.dishes.get(dish.dishId);
    if (stored) return Promise.resolve(stored);
    this.dishes.set(dish.dishId, dish);
    this.addToCounts(dish.orderId, dish.status, 1);
    return Promise.resolve(dish);
  }

  findDish(dishId: string): Promise<Dish | undefined> {
    return Promise.resolve(this.dishes.get(dishId));
  }

  updateDishStatus(dish: Dish, to: DishStatus, at: string): Promise<boolean> {
    const stored = this.dishes.get(dish.dishId);
    if (stored?.status !== dish.status) return Promise.resolve(false);
    this.dishes.set(dish.dishId, { ...stored, status: to, updatedAt: at });
    this.addToCounts(dish.orderId, dish.status, -1);
    this.addToCounts(dish.orderId, to, 1);
    return Promise.resolve(true);
  }

  private addToCounts(orderId: string, status: DishStatus, delta: number): void {
    const order = this.orders.get(orderId);
    if (order) order.counts[status] += delta;
  }
}
