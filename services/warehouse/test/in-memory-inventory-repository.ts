import { INGREDIENTS, type Ingredient } from '@lunch/contracts';
import type { InventoryRepository, PurchaseReceipt, StockMove } from '../src/application/ports.js';
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
    if (stock < move.quantity || !this.updateReserved(move, move.quantity)) return false;
    this.stock.set(move.ingredient, stock - move.quantity);
    return true;
  }

  async receivePurchase(receipt: PurchaseReceipt): Promise<boolean> {
    await tick();
    const reservation = this.reservations.get(receipt.dishId);
    if (reservation?.appliedPurchases?.includes(receipt.purchaseId)) return false;
    if (!this.updateReserved(receipt, receipt.allocated, receipt.purchaseId)) return false;
    const stock = this.stock.get(receipt.ingredient) ?? INITIAL_STOCK;
    this.stock.set(receipt.ingredient, stock + receipt.surplus);
    return true;
  }

  private updateReserved(change: StockMove | PurchaseReceipt, added: number, purchaseId?: string) {
    const reservation = this.reservations.get(change.dishId);
    const line = reservation?.lines[change.ingredient];
    if (!reservation || !line || line.reserved !== change.reservedBefore) return false;
    this.reservations.set(change.dishId, {
      ...reservation,
      lines: {
        ...reservation.lines,
        [change.ingredient]: { ...line, reserved: line.reserved + added },
      },
      ...(purchaseId && {
        appliedPurchases: [...(reservation.appliedPurchases ?? []), purchaseId],
      }),
    });
    return true;
  }
}
