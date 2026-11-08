import type { Ingredient } from '@lunch/contracts';
import type { PurchaseAllocation, Reservation } from '../domain/reservation.js';

interface ReservationChange {
  readonly dishId: string;
  readonly ingredient: Ingredient;
  readonly reservedBefore: number;
}

export interface StockMove extends ReservationChange {
  readonly quantity: number;
}

export interface PurchaseReceipt extends ReservationChange, PurchaseAllocation {
  readonly purchaseId: string;
}

export interface InventoryRepository {
  openReservation(reservation: Reservation): Promise<Reservation>;
  findReservation(dishId: string): Promise<Reservation | undefined>;
  getStock(ingredient: Ingredient): Promise<number>;
  listStock(): Promise<Record<Ingredient, number>>;
  moveStockToReservation(move: StockMove): Promise<boolean>;
  receivePurchase(receipt: PurchaseReceipt): Promise<boolean>;
}
