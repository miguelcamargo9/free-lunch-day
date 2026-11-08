import { beforeEach, describe, expect, it } from 'vitest';
import { RecordingPublisher, localDynamo } from '@lunch/shared/testing';
import { Warehouse } from '../src/application/warehouse.js';
import { DynamoInventoryRepository } from '../src/infrastructure/dynamo-inventory-repository.js';

const dishIds = Array.from(
  { length: 20 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
);

describe('DynamoInventoryRepository', () => {
  let repository: DynamoInventoryRepository;
  let publisher: RecordingPublisher;
  let warehouse: Warehouse;

  beforeEach(async () => {
    const dynamo = localDynamo();
    const [inventory, reservations] = await Promise.all([
      dynamo.createTable({
        AttributeDefinitions: [{ AttributeName: 'ingredient', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'ingredient', KeyType: 'HASH' }],
      }),
      dynamo.createTable({
        AttributeDefinitions: [{ AttributeName: 'dishId', AttributeType: 'S' }],
        KeySchema: [{ AttributeName: 'dishId', KeyType: 'HASH' }],
      }),
    ]);
    repository = new DynamoInventoryRepository(dynamo.client, { inventory, reservations });
    publisher = new RecordingPublisher();
    warehouse = new Warehouse(repository, publisher);
  });

  it('starts every ingredient at the initial stock', async () => {
    const stock = await repository.listStock();

    expect(Object.values(stock)).toEqual(Array(10).fill(5));
  });

  it('reserves partially and keeps the reservation idempotent', async () => {
    await warehouse.reserveIngredients(dishIds[0] as string, [{ ingredient: 'rice', quantity: 7 }]);
    await warehouse.reserveIngredients(dishIds[0] as string, [{ ingredient: 'rice', quantity: 7 }]);

    expect(await repository.getStock('rice')).toBe(0);
    expect((await repository.findReservation(dishIds[0] as string))?.lines.rice).toEqual({
      needed: 7,
      reserved: 5,
    });
  });

  it('never oversells stock when many dishes compete for it', async () => {
    await Promise.all(
      dishIds.map((dishId) =>
        warehouse.reserveIngredients(dishId, [{ ingredient: 'tomato', quantity: 1 }]),
      ),
    );

    const reservations = await Promise.all(dishIds.map((id) => repository.findReservation(id)));
    const reserved = reservations.reduce((sum, r) => sum + (r?.lines.tomato?.reserved ?? 0), 0);
    expect(await repository.getStock('tomato')).toBe(0);
    expect(reserved).toBe(5);
    expect(publisher.ofType('IngredientsReserved')).toHaveLength(5);
  });

  it('applies a purchase once and sends the surplus to stock', async () => {
    const dishId = dishIds[0] as string;
    await repository.openReservation({ dishId, lines: { rice: { needed: 2, reserved: 0 } } });
    const receipt = {
      dishId,
      ingredient: 'rice' as const,
      purchaseId: crypto.randomUUID(),
      reservedBefore: 0,
      allocated: 2,
      surplus: 3,
    };

    expect(await repository.receivePurchase(receipt)).toBe(true);
    expect(await repository.receivePurchase(receipt)).toBe(false);

    expect(await repository.getStock('rice')).toBe(8);
    expect((await repository.findReservation(dishId))?.appliedPurchases).toEqual([
      receipt.purchaseId,
    ]);
  });
});
