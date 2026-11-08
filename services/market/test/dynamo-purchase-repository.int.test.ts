import { beforeAll, describe, expect, it } from 'vitest';
import { localDynamo } from '@lunch/shared/testing';
import type { Purchase, PurchaseRequest } from '../src/domain/purchase.js';
import { DynamoPurchaseRepository } from '../src/infrastructure/dynamo-purchase-repository.js';

const request: PurchaseRequest = {
  requestId: '11111111-1111-4111-8111-111111111111',
  dishId: '7c2e4a90-1b3d-4e5f-8a6b-9c0d1e2f3a4b',
  ingredient: 'rice',
  requested: 3,
  purchased: 0,
  attempts: 0,
  scheduledAttempt: 0,
  createdAt: '2026-11-07T12:00:00.000Z',
  updatedAt: '2026-11-07T12:00:00.000Z',
};

function purchase(attempt: number, quantitySold: number, at: string): Purchase {
  return {
    purchaseId: `22222222-2222-4222-8222-${String(attempt).padStart(12, '0')}`,
    requestId: request.requestId,
    dishId: request.dishId,
    ingredient: 'rice',
    requested: 3,
    quantitySold,
    attempt,
    at,
  };
}

describe('DynamoPurchaseRepository', () => {
  let repository: DynamoPurchaseRepository;

  beforeAll(async () => {
    const dynamo = localDynamo();
    const [requests, purchases] = await Promise.all([
      dynamo.createTable({
        AttributeDefinitions: [{ AttributeName: 'requestId', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'requestId', KeyType: 'HASH' }],
      }),
      dynamo.createTable({
        AttributeDefinitions: [
          { AttributeName: 'purchaseId', AttributeType: 'S' },
          { AttributeName: 'kind', AttributeType: 'S' },
          { AttributeName: 'at', AttributeType: 'S' },
        ],
        KeySchema: [{ AttributeName: 'purchaseId', KeyType: 'HASH' }],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'byTime',
            KeySchema: [
              { AttributeName: 'kind', KeyType: 'HASH' },
              { AttributeName: 'at', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    ]);
    repository = new DynamoPurchaseRepository(dynamo.client, {
      requests,
      purchases,
      purchasesByTimeIndex: 'byTime',
    });
  });

  it('records each attempt once and lists purchases newest first', async () => {
    await repository.openRequest(request);
    const first = purchase(1, 0, '2026-11-07T12:00:01.000Z');
    const second = purchase(2, 2, '2026-11-07T12:00:05.000Z');

    expect(await repository.recordPurchase(request, first)).toBe(true);
    expect(await repository.recordPurchase(request, first)).toBe(false);
    const afterFirst = (await repository.findRequest(request.requestId)) as PurchaseRequest;
    expect(await repository.recordPurchase(afterFirst, second)).toBe(true);

    expect(await repository.findRequest(request.requestId)).toMatchObject({
      attempts: 2,
      purchased: 2,
    });
    expect(await repository.findPurchase(second.purchaseId)).toEqual(second);
    expect((await repository.listRecentPurchases(10)).map((p) => p.attempt)).toEqual([2, 1]);
  });
});
