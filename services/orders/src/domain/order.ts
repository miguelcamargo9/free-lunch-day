import { DISH_STATUSES, type DishStatus } from '@lunch/contracts';

export type DishCounts = Record<DishStatus, number>;

export interface Order {
  readonly orderId: string;
  readonly quantity: number;
  readonly createdAt: string;
  readonly counts: DishCounts;
}

export function newOrder(orderId: string, quantity: number, createdAt: string): Order {
  const counts = Object.fromEntries(DISH_STATUSES.map((status) => [status, 0])) as DishCounts;
  return { orderId, quantity, createdAt, counts };
}
