import { DISH_STATUSES, type DishStatus } from '@lunch/contracts';

export interface Order {
  readonly orderId: string;
  readonly quantity: number;
  readonly createdAt: string;
}

export type DishCounts = Record<DishStatus, number>;

export interface OrderSummary extends Order {
  readonly counts: DishCounts;
}

export function countByStatus(statuses: readonly DishStatus[]): DishCounts {
  const counts = Object.fromEntries(DISH_STATUSES.map((status) => [status, 0])) as DishCounts;
  for (const status of statuses) counts[status] += 1;
  return counts;
}
