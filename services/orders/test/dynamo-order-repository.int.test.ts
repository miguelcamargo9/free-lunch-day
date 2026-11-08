import { beforeAll, describe, expect, it } from 'vitest';
import { localDynamo } from '@lunch/shared/testing';
import type { Dish } from '../src/domain/dish.js';
import { DynamoOrderRepository } from '../src/infrastructure/dynamo-order-repository.js';

const at = '2026-11-07T12:00:00.000Z';
const orderId = '0b6f5d1e-8c1a-4f7e-9a3b-2d4c6e8f0a12';

function dish(index: number, recipeId = 'chicken-rice'): Dish {
  const dishId = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return { dishId, orderId, recipeId, status: 'PENDING', createdAt: at, updatedAt: at };
}

describe('DynamoOrderRepository', () => {
  let repository: DynamoOrderRepository;

  beforeAll(async () => {
    const dynamo = localDynamo();
    const [orders, dishes] = await Promise.all([
      dynamo.createTable({
        AttributeDefinitions: [{ AttributeName: 'orderId', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'orderId', KeyType: 'HASH' }],
      }),
      dynamo.createTable({
        AttributeDefinitions: [
          { AttributeName: 'dishId', AttributeType: 'S' },
          { AttributeName: 'orderId', AttributeType: 'S' },
        ],
        KeySchema: [{ AttributeName: 'dishId', KeyType: 'HASH' }],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'byOrder',
            KeySchema: [{ AttributeName: 'orderId', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'INCLUDE', NonKeyAttributes: ['status'] },
          },
        ],
      }),
    ]);
    repository = new DynamoOrderRepository(dynamo.client, {
      orders,
      dishes,
      dishesByOrderIndex: 'byOrder',
    });
    await repository.saveOrder({ orderId, quantity: 60, createdAt: at });
  });

  it('rejects saving the same order twice', async () => {
    await expect(repository.saveOrder({ orderId, quantity: 1, createdAt: at })).rejects.toThrow();
  });

  it('keeps the first recipe when a dish is created again', async () => {
    await repository.createDish(dish(1, 'cheeseburger'));

    const again = await repository.createDish(dish(1, 'potato-gratin'));

    expect(again.recipeId).toBe('cheeseburger');
  });

  it('only moves a dish from the status it was read in', async () => {
    const created = await repository.createDish(dish(2));

    expect(await repository.updateDishStatus(created, 'PREPARING', at)).toBe(true);
    expect(await repository.updateDishStatus(created, 'PREPARING', at)).toBe(false);
    expect((await repository.findDish(created.dishId))?.status).toBe('PREPARING');
  });

  it('creates many dishes of one order concurrently and lists their statuses', async () => {
    await Promise.all(Array.from({ length: 50 }, (_, i) => repository.createDish(dish(100 + i))));

    const statuses = await repository.listDishStatuses(orderId);

    expect(statuses.filter((status) => status === 'PENDING').length).toBeGreaterThanOrEqual(50);
  });
});
