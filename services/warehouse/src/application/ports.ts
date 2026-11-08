import type { Ingredient } from '@lunch/contracts';
import type { Reservation } from '../domain/reservation.js';

export interface StockMove {
  readonly dishId: string;
  readonly ingredient: Ingredient;
  readonly quantity: number;
  readonly reservedBefore: number;
}

export interface InventoryRepository {
  openReservation(reservation: Reservation): Promise<Reservation>;
  findReservation(dishId: string): Promise<Reservation | undefined>;
  getStock(ingredient: Ingredient): Promise<number>;
  listStock(): Promise<Record<Ingredient, number>>;
  moveStockToReservation(move: StockMove): Promise<boolean>;
}
