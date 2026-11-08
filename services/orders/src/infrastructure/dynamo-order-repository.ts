import {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { DishStatus } from '@lunch/contracts';
import { isConditionFailure } from '@lunch/shared';
import type { OrderRepository } from '../application/ports.js';
import type { Dish } from '../domain/dish.js';
import type { Order } from '../domain/order.js';

export interface OrderTables {
  readonly orders: string;
  readonly dishes: string;
}

export class DynamoOrderRepository implements OrderRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: OrderTables,
  ) {}

  async saveOrder(order: Order): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tables.orders,
        Item: order,
        ConditionExpression: 'attribute_not_exists(orderId)',
      }),
    );
  }

  async findOrder(orderId: string): Promise<Order | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tables.orders, Key: { orderId } }),
    );
    return Item as Order | undefined;
  }

  async createDish(dish: Dish): Promise<Dish> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tables.dishes,
                Item: dish,
                ConditionExpression: 'attribute_not_exists(dishId)',
              },
            },
            this.countsUpdate(dish.orderId, { [dish.status]: 1 }),
          ],
        }),
      );
      return dish;
    } catch (error) {
      if (!isConditionFailure(error)) throw error;
      const stored = await this.findDish(dish.dishId);
      if (!stored) throw error;
      return stored;
    }
  }

  async findDish(dishId: string): Promise<Dish | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tables.dishes, Key: { dishId }, ConsistentRead: true }),
    );
    return Item as Dish | undefined;
  }

  async updateDishStatus(dish: Dish, to: DishStatus, at: string): Promise<boolean> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tables.dishes,
                Key: { dishId: dish.dishId },
                UpdateExpression: 'SET #status = :to, updatedAt = :at',
                ConditionExpression: '#status = :from',
                ExpressionAttributeNames: { '#status': 'status' },
                ExpressionAttributeValues: { ':from': dish.status, ':to': to, ':at': at },
              },
            },
            this.countsUpdate(dish.orderId, { [dish.status]: -1, [to]: 1 }),
          ],
        }),
      );
      return true;
    } catch (error) {
      if (isConditionFailure(error)) return false;
      throw error;
    }
  }

  private countsUpdate(orderId: string, deltas: Partial<Record<DishStatus, number>>) {
    const entries = Object.entries(deltas);
    return {
      Update: {
        TableName: this.tables.orders,
        Key: { orderId },
        UpdateExpression: `SET ${entries.map((_, i) => `counts.#s${i} = counts.#s${i} + :d${i}`).join(', ')}`,
        ExpressionAttributeNames: Object.fromEntries(
          entries.map(([status], i) => [`#s${i}`, status]),
        ),
        ExpressionAttributeValues: Object.fromEntries(
          entries.map(([, delta], i) => [`:d${i}`, delta]),
        ),
      },
    };
  }
}
