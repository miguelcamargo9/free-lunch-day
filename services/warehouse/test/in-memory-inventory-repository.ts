import { INGREDIENTS, type Ingredient } from '@lunch/contracts';
import type { InventoryRepository, StockMove } from '../src/application/ports.js';
import { INITIAL_STOCK, type Reservation } from '../src/domain/reservation.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

export class InMemoryInventoryRepository implements InventoryRepository {
  readonly stock = new Map<Ingredient, number>();
  readonly reservations = new Map<string, Reservation>();

  async openReservation(reservation: Reservation): Promise<Reservation> {
    await tick();
    const stored = this.reservations.get(reservation.dishId);
    if (stored) return stored;
    this.reservations.set(reservation.dishId, structuredClone(reservation));
    return reservation;
  }

  async findReservation(dishId: string): Promise<Reservation | undefined> {
    await tick();
    return structuredClone(this.reservations.get(dishId));
  }

  async getStock(ingredient: Ingredient): Promise<number> {
    await tick();
    return this.stock.get(ingredient) ?? INITIAL_STOCK;
  }

  async listStock(): Promise<Record<Ingredient, number>> {
    await tick();
    return Object.fromEntries(
      INGREDIENTS.map((ingredient) => [ingredient, this.stock.get(ingredient) ?? INITIAL_STOCK]),
    ) as Record<Ingredient, number>;
  }

  async moveStockToReservation(move: StockMove): Promise<boolean> {
    await tick();
    const stock = this.stock.get(move.ingredient) ?? INITIAL_STOCK;
    const reservation = this.reservations.get(move.dishId);
    const line = reservation?.lines[move.ingredient];
    if (!reservation || !line || stock < move.quantity || line.reserved !== move.reservedBefore) {
      return false;
    }
    this.stock.set(move.ingredient, stock - move.quantity);
    this.reservations.set(move.dishId, {
      ...reservation,
      lines: {
        ...reservation.lines,
        [move.ingredient]: { ...line, reserved: line.reserved + move.quantity },
      },
    });
    return true;
  }
}
