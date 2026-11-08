import { DISH_STATUSES, type DishStatus } from '@lunch/contracts';

export interface Dish {
  readonly dishId: string;
  readonly orderId: string;
  readonly recipeId: string;
  readonly status: DishStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DishRef {
  readonly dishId: string;
  readonly orderId: string;
  readonly recipeId: string;
}

const PREDECESSORS: Record<DishStatus, readonly DishStatus[]> = {
  PENDING: [],
  WAITING_INGREDIENTS: ['PENDING'],
  PREPARING: ['PENDING', 'WAITING_INGREDIENTS'],
  DELIVERED: ['PREPARING'],
};

export function canTransition(from: DishStatus, to: DishStatus): boolean {
  return PREDECESSORS[to].includes(from);
}

export function hasReached(status: DishStatus, target: DishStatus): boolean {
  return DISH_STATUSES.indexOf(status) >= DISH_STATUSES.indexOf(target);
}

export function toDishRef({ dishId, orderId, recipeId }: DishRef): DishRef {
  return { dishId, orderId, recipeId };
}
