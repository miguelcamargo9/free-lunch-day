import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { isConditionFailure, isWriteConflict, putIfAbsent } from '@lunch/shared';
import type { PurchaseRepository } from '../application/ports.js';
import type { Purchase, PurchaseRequest } from '../domain/purchase.js';

export interface PurchaseTables {
  readonly requests: string;
  readonly purchases: string;
  readonly purchasesByTimeIndex: string;
}

const PURCHASE_KIND = 'purchase';

export class DynamoPurchaseRepository implements PurchaseRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tables: PurchaseTables,
  ) {}

  openRequest(request: PurchaseRequest): Promise<PurchaseRequest> {
    return putIfAbsent(this.client, this.tables.requests, 'requestId', request);
  }

  async findRequest(requestId: string): Promise<PurchaseRequest | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.tables.requests, Key: { requestId }, ConsistentRead: true }),
    );
    return Item as PurchaseRequest | undefined;
  }

  async findPurchase(purchaseId: string): Promise<Purchase | undefined> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.tables.purchases,
        Key: { purchaseId },
        ConsistentRead: true,
      }),
    );
    return Item && toPurchase(Item);
  }

  async recordPurchase(request: PurchaseRequest, purchase: Purchase): Promise<boolean> {
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: this.tables.requests,
                Key: { requestId: request.requestId },
                UpdateExpression:
                  'SET attempts = :attempt, purchased = purchased + :sold, updatedAt = :at',
                ConditionExpression: 'attempts = :previous',
                ExpressionAttributeValues: {
                  ':attempt': purchase.attempt,
                  ':previous': request.attempts,
                  ':sold': purchase.quantitySold,
                  ':at': purchase.at,
                },
              },
            },
            {
              Put: {
                TableName: this.tables.purchases,
                Item: { ...purchase, kind: PURCHASE_KIND },
                ConditionExpression: 'attribute_not_exists(purchaseId)',
              },
            },
          ],
        }),
      );
      return true;
    } catch (error) {
      if (isWriteConflict(error)) return false;
      throw error;
    }
  }

  async markScheduled(requestId: string, attempt: number): Promise<void> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tables.requests,
          Key: { requestId },
          UpdateExpression: 'SET scheduledAttempt = :attempt',
          ConditionExpression: 'scheduledAttempt < :attempt',
          ExpressionAttributeValues: { ':attempt': attempt },
        }),
      );
    } catch (error) {
      if (!isConditionFailure(error)) throw error;
    }
  }

  async listRecentPurchases(limit: number): Promise<Purchase[]> {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tables.purchases,
        IndexName: this.tables.purchasesByTimeIndex,
        KeyConditionExpression: 'kind = :kind',
        ExpressionAttributeValues: { ':kind': PURCHASE_KIND },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items.map(toPurchase);
  }
}

function toPurchase(item: Record<string, unknown>): Purchase {
  const { kind, ...purchase } = item;
  return purchase as unknown as Purchase;
}
