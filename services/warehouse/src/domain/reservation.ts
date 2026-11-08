import type { Ingredient, IngredientQuantity } from '@lunch/contracts';

export const INITIAL_STOCK = 5;

export interface ReservationLine {
  readonly needed: number;
  readonly reserved: number;
}

export interface Reservation {
  readonly dishId: string;
  readonly lines: Partial<Record<Ingredient, ReservationLine>>;
  readonly appliedPurchases?: readonly string[];
}

export interface PurchaseAllocation {
  readonly allocated: number;
  readonly surplus: number;
}

export function newReservation(
  dishId: string,
  ingredients: readonly IngredientQuantity[],
): Reservation {
  const lines = Object.fromEntries(
    ingredients.map(({ ingredient, quantity }) => [ingredient, { needed: quantity, reserved: 0 }]),
  );
  return { dishId, lines };
}

export function reservationLines(reservation: Reservation): [Ingredient, ReservationLine][] {
  return Object.entries(reservation.lines) as [Ingredient, ReservationLine][];
}

export function missingIngredients(reservation: Reservation): IngredientQuantity[] {
  return reservationLines(reservation)
    .map(([ingredient, line]) => ({ ingredient, quantity: line.needed - line.reserved }))
    .filter(({ quantity }) => quantity > 0);
}

export function neededIngredients(reservation: Reservation): IngredientQuantity[] {
  return reservationLines(reservation).map(([ingredient, line]) => ({
    ingredient,
    quantity: line.needed,
  }));
}

export function quantityToTake(stock: number, missing: number): number {
  return Math.max(0, Math.min(stock, missing));
}

export function allocatePurchase(line: ReservationLine, quantitySold: number): PurchaseAllocation {
  const allocated = quantityToTake(quantitySold, line.needed - line.reserved);
  return { allocated, surplus: quantitySold - allocated };
}
