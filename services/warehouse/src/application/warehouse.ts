import {
  IngredientsReserved,
  IngredientsShortage,
  createEvent,
  type Ingredient,
  type IngredientQuantity,
} from '@lunch/contracts';
import type { EventPublisher } from '@lunch/shared';
import {
  missingIngredients,
  neededIngredients,
  newReservation,
  quantityToTake,
  type Reservation,
} from '../domain/reservation.js';
import type { InventoryRepository } from './ports.js';

const MAX_RESERVE_ATTEMPTS = 10;

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
    await this.publishOutcome(await this.getReservation(dishId));
  }

  listStock(): Promise<Record<Ingredient, number>> {
    return this.repository.listStock();
  }

  private async reserveFromStock(dishId: string, ingredient: Ingredient): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RESERVE_ATTEMPTS; attempt++) {
      const [reservation, stock] = await Promise.all([
        this.getReservation(dishId),
        this.repository.getStock(ingredient),
      ]);
      const line = reservation.lines[ingredient];
      if (!line) return;
      const quantity = quantityToTake(stock, line.needed - line.reserved);
      if (quantity === 0) return;
      const moved = await this.repository.moveStockToReservation({
        dishId,
        ingredient,
        quantity,
        reservedBefore: line.reserved,
      });
      if (moved) return;
    }
    throw new Error(`Gave up reserving ${ingredient} for dish ${dishId} under contention`);
  }

  private async publishOutcome(reservation: Reservation): Promise<void> {
    const { dishId } = reservation;
    const missing = missingIngredients(reservation);
    const event =
      missing.length > 0
        ? createEvent(IngredientsShortage, { dishId, missing }, dishId)
        : createEvent(
            IngredientsReserved,
            { dishId, ingredients: neededIngredients(reservation) },
            dishId,
          );
    await this.publisher.publish([event]);
  }

  private async getReservation(dishId: string): Promise<Reservation> {
    const reservation = await this.repository.findReservation(dishId);
    if (!reservation) throw new Error(`Unknown reservation for dish ${dishId}`);
    return reservation;
  }
}
