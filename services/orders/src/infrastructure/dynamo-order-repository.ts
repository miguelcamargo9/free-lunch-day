import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  paginateQuery,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { DishStatus } from '@lunch/contracts';
import { isConditionFailure, putIfAbsent } from '@lunch/shared';
import type { OrderRepository } from '../application/ports.js';
import type { Dish } from '../domain/dish.js';
import type { Order } from '../domain/order.js';

export interface OrderTables {
  readonly orders: string;
  readonly dishes: string;
  readonly dishesByOrderIndex: string;
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

  createDish(dish: Dish): Promise<Dish> {
    return putIfAbsent(this.client, this.tables.dishes, 'dishId', dish);
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
        new UpdateCommand({
          TableName: this.tables.dishes,
          Key: { dishId: dish.dishId },
          UpdateExpression: 'SET #status = :to, updatedAt = :at',
          ConditionExpression: '#status = :from',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':from': dish.status, ':to': to, ':at': at },
        }),
      );
      return true;
    } catch (error) {
      if (isConditionFailure(error)) return false;
      throw error;
    }
  }

  async listDishStatuses(orderId: string): Promise<DishStatus[]> {
    const pages = paginateQuery(
      { client: this.client },
      {
        TableName: this.tables.dishes,
        IndexName: this.tables.dishesByOrderIndex,
        KeyConditionExpression: 'orderId = :orderId',
        ProjectionExpression: '#status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':orderId': orderId },
      },
    );
    const statuses: DishStatus[] = [];
    for await (const page of pages) {
      statuses.push(...(page.Items ?? []).map((item) => item.status as DishStatus));
    }
    return statuses;
  }
}
