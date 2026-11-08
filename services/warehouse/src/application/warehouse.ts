import {
  IngredientsReserved,
  IngredientsShortage,
  createEvent,
  type EventPayload,
  type Ingredient,
  type IngredientPurchased,
  type IngredientQuantity,
} from '@lunch/contracts';
import { retryOnConflict, type EventPublisher } from '@lunch/shared';
import {
  allocatePurchase,
  missingIngredients,
  neededIngredients,
  newReservation,
  quantityToTake,
  type Reservation,
  type ReservationLine,
} from '../domain/reservation.js';
import type { InventoryRepository } from './ports.js';

export class Warehouse {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async reserveIngredients(dishId: string, ingredients: readonly IngredientQuantity[]) {
    const opened = await this.repository.openReservation(newReservation(dishId, ingredients));
    for (const { ingredient } of missingIngredients(opened)) {
      await this.reserveFromStock(dishId, ingredient);
    }
    const reservation = await this.getReservation(dishId);
    const missing = missingIngredients(reservation);
    await this.publisher.publish([
      missing.length > 0
        ? createEvent(IngredientsShortage, { dishId, missing }, dishId)
        : this.reservedEvent(reservation),
    ]);
  }

  async receivePurchase({
    purchaseId,
    dishId,
    ingredient,
    quantitySold,
  }: EventPayload<typeof IngredientPurchased>) {
    await retryOnConflict(async () => {
      const reservation = await this.getReservation(dishId);
      if (reservation.appliedPurchases?.includes(purchaseId)) return true;
      const line = this.getLine(reservation, ingredient);
      return this.repository.receivePurchase({
        dishId,
        ingredient,
        purchaseId,
        reservedBefore: line.reserved,
        ...allocatePurchase(line, quantitySold),
      });
    });
    const reservation = await this.getReservation(dishId);
    if (missingIngredients(reservation).length === 0) {
      await this.publisher.publish([this.reservedEvent(reservation)]);
    }
  }

  private reserveFromStock(dishId: string, ingredient: Ingredient): Promise<void> {
    return retryOnConflict(async () => {
      const [reservation, stock] = await Promise.all([
        this.getReservation(dishId),
        this.repository.getStock(ingredient),
      ]);
      const line = this.getLine(reservation, ingredient);
      const quantity = quantityToTake(stock, line.needed - line.reserved);
      if (quantity === 0) return true;
      return this.repository.moveStockToReservation({
        dishId,
        ingredient,
        quantity,
        reservedBefore: line.reserved,
      });
    });
  }

  private reservedEvent(reservation: Reservation) {
    const { dishId } = reservation;
    return createEvent(
      IngredientsReserved,
      { dishId, ingredients: neededIngredients(reservation) },
      dishId,
    );
  }

  private getLine(reservation: Reservation, ingredient: Ingredient): ReservationLine {
    const line = reservation.lines[ingredient];
    if (!line) throw new Error(`Dish ${reservation.dishId} does not use ${ingredient}`);
    return line;
  }

  private async getReservation(dishId: string): Promise<Reservation> {
    const reservation = await this.repository.findReservation(dishId);
    if (!reservation) throw new Error(`Unknown reservation for dish ${dishId}`);
    return reservation;
  }
}
