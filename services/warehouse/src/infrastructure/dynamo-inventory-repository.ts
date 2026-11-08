import {
  GetCommand,
  ScanCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
  type TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { INGREDIENTS, type Ingredient } from '@lunch/contracts';
import { isWriteConflict, putIfAbsent } from '@lunch/shared';
import type { InventoryRepository, PurchaseReceipt, StockMove } from '../application/ports.js';
import { INITIAL_STOCK, type Reservation } from '../domain/reservation.js';

export interface InventoryTables {
  readonly inventory: string;
  readonly reservations: string;
}

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

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

  openReservation(reservation: Reservation): Promise<Reservation> {
    return putIfAbsent(this.client, this.tables.reservations, 'dishId', reservation);
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
    return this.transact([
      this.stockChange(move.ingredient, -move.quantity),
      this.reservedChange(move, move.quantity),
    ]);
  }

  async receivePurchase(receipt: PurchaseReceipt): Promise<boolean> {
    const reservation = this.reservedChange(receipt, receipt.allocated, receipt.purchaseId);
    return this.transact(
      receipt.surplus > 0
        ? [reservation, this.stockChange(receipt.ingredient, receipt.surplus)]
        : [reservation],
    );
  }

  private async transact(items: TransactItem[]): Promise<boolean> {
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: items }));
      return true;
    } catch (error) {
      if (isWriteConflict(error)) return false;
      throw error;
    }
  }

  private stockChange(ingredient: Ingredient, delta: number): TransactItem {
    return {
      Update: {
        TableName: this.tables.inventory,
        Key: { ingredient },
        UpdateExpression: 'SET stock = if_not_exists(stock, :initial) + :delta',
        ConditionExpression: 'attribute_not_exists(stock) OR stock >= :minimum',
        ExpressionAttributeValues: {
          ':initial': INITIAL_STOCK,
          ':delta': delta,
          ':minimum': Math.max(0, -delta),
        },
      },
    };
  }

  private reservedChange(
    change: StockMove | PurchaseReceipt,
    added: number,
    purchaseId?: string,
  ): TransactItem {
    const purchase = purchaseId === undefined ? undefined : { ':purchaseId': purchaseId };
    return {
      Update: {
        TableName: this.tables.reservations,
        Key: { dishId: change.dishId },
        UpdateExpression: purchase
          ? 'SET #lines.#ingredient.reserved = :after, appliedPurchases = list_append(if_not_exists(appliedPurchases, :none), :purchases)'
          : 'SET #lines.#ingredient.reserved = :after',
        ConditionExpression: purchase
          ? '#lines.#ingredient.reserved = :before AND NOT contains(appliedPurchases, :purchaseId)'
          : '#lines.#ingredient.reserved = :before',
        ExpressionAttributeNames: { '#lines': 'lines', '#ingredient': change.ingredient },
        ExpressionAttributeValues: {
          ':before': change.reservedBefore,
          ':after': change.reservedBefore + added,
          ...(purchase && { ...purchase, ':none': [], ':purchases': [purchaseId] }),
        },
      },
    };
  }
}
