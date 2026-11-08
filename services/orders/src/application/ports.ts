import type { DishStatus } from '@lunch/contracts';
import type { Dish } from '../domain/dish.js';
import type { Order } from '../domain/order.js';

export interface OrderRepository {
  saveOrder(order: Order): Promise<void>;
  findOrder(orderId: string): Promise<Order | undefined>;
  createDish(dish: Dish): Promise<Dish>;
  findDish(dishId: string): Promise<Dish | undefined>;
  updateDishStatus(dish: Dish, to: DishStatus, at: string): Promise<boolean>;
  listDishStatuses(orderId: string): Promise<DishStatus[]>;
}
