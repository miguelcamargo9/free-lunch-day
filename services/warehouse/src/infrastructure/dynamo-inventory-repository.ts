import {
  GetCommand,
  PutCommand,
  ScanCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { INGREDIENTS, type Ingredient } from '@lunch/contracts';
import { isConditionFailure } from '@lunch/shared';
import type { InventoryRepository, StockMove } from '../application/ports.js';
import { INITIAL_STOCK, type Reservation } from '../domain/reservation.js';

export interface InventoryTables {
  readonly inventory: string;
  readonly reservations: string;
}

interface StockItem {
  readonly ingredient: Ingredient;
  readonly stock: number;
}

// Missing inventory items hold INITIAL_STOCK: the warehouse starts full without a seeding step.
export class DynamoInventoryRepository implements InventoryRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: InventoryTables,
  ) {}

  async openReservation(reservation: Reservation): Promise<Reservation> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tables.reservations,
          Item: reservation,
          ConditionExpression: 'attribute_not_exists(dishId)',
        }),
      );
      return reservation;
    } catch (error) {
      if (!isConditionFailure(error)) throw error;
      const stored = await this.findReservation(reservation.dishId);
      if (!stored) throw error;
      return stored;
    }
  }

  async findReservation(dishId: string): Promise<Reservation | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.tables.reservations,
        Key: { dishId },
        ConsistentRead: true,
      }),
    );
    return Item as Reservation | undefined;
  }

  async getStock(ingredient: Ingredient): Promise<number> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.tables.inventory,
        Key: { ingredient },
        ConsistentRead: true,
      }),
    );
    return (Item as StockItem | undefined)?.stock ?? INITIAL_STOCK;
  }

  async listStock(): Promise<Record<Ingredient, number>> {
    const { Items = [] } = await this.client.send(
      new ScanCommand({ TableName: this.tables.inventory }),
    );
    const stored = new Map((Items as StockItem[]).map((item) => [item.ingredient, item.stock]));
    return Object.fromEntries(
      INGREDIENTS.map((ingredient) => [ingredient, stored.get(ingredient) ?? INITIAL_STOCK]),
    ) as Record<Ingredient, number>;
  }

  async moveStockToReservation(move: StockMove): Promise<boolean> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tables.inventory,
                Key: { ingredient: move.ingredient },
                UpdateExpression: 'SET stock = if_not_exists(stock, :initial) - :n',
                ConditionExpression: 'attribute_not_exists(stock) OR stock >= :n',
                ExpressionAttributeValues: { ':initial': INITIAL_STOCK, ':n': move.quantity },
              },
            },
            {
              Update: {
                TableName: this.tables.reservations,
                Key: { dishId: move.dishId },
                UpdateExpression: 'SET lines.#ingredient.reserved = :after',
                ConditionExpression: 'lines.#ingredient.reserved = :before',
                ExpressionAttributeNames: { '#ingredient': move.ingredient },
                ExpressionAttributeValues: {
                  ':before': move.reservedBefore,
                  ':after': move.reservedBefore + move.quantity,
                },
              },
            },
          ],
        }),
      );
      return true;
    } catch (error) {
      if (isConditionFailure(error)) return false;
      throw error;
    }
  }
}
