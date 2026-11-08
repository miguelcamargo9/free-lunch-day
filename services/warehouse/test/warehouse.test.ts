import { beforeEach, describe, expect, it } from 'vitest';
import type { IngredientQuantity } from '@lunch/contracts';
import { RecordingPublisher } from '@lunch/shared/testing';
import { Warehouse } from '../src/application/warehouse.js';
import { InMemoryInventoryRepository } from './in-memory-inventory-repository.js';

const dishIds = Array.from(
  { length: 20 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
);
const rice = (quantity: number): IngredientQuantity[] => [{ ingredient: 'rice', quantity }];
const riceSold = (quantitySold: number, purchaseId = crypto.randomUUID()) => ({
  purchaseId,
  dishId: dishIds[0] as string,
  ingredient: 'rice' as const,
  requested: 2,
  attempt: 1,
  quantitySold,
});

describe('Warehouse', () => {
  let repository: InMemoryInventoryRepository;
  let publisher: RecordingPublisher;
  let warehouse: Warehouse;

  beforeEach(() => {
    repository = new InMemoryInventoryRepository();
    publisher = new RecordingPublisher();
    warehouse = new Warehouse(repository, publisher);
  });

  it('reserves a dish fully when stock is enough', async () => {
    await warehouse.reserveIngredients(dishIds[0] as string, rice(2));

    expect(repository.stock.get('rice')).toBe(3);
    expect(publisher.ofType('IngredientsReserved')).toHaveLength(1);
  });

  it('reserves what is in stock and reports only the shortfall', async () => {
    repository.stock.set('rice', 1);

    await warehouse.reserveIngredients(dishIds[0] as string, rice(3));

    expect(repository.stock.get('rice')).toBe(0);
    expect(repository.reservations.get(dishIds[0] as string)?.lines.rice).toEqual({
      needed: 3,
      reserved: 1,
    });
    expect(publisher.ofType('IngredientsShortage')[0]?.detail.payload).toMatchObject({
      missing: [{ ingredient: 'rice', quantity: 2 }],
    });
  });

  it('does not reserve twice when a request is retried', async () => {
    await warehouse.reserveIngredients(dishIds[0] as string, rice(2));
    await warehouse.reserveIngredients(dishIds[0] as string, rice(2));

    expect(repository.stock.get('rice')).toBe(3);
    expect(publisher.ofType('IngredientsReserved')).toHaveLength(2);
  });

  it('never oversells stock when many dishes compete for it', async () => {
    await Promise.all(dishIds.map((dishId) => warehouse.reserveIngredients(dishId, rice(1))));

    const reserved = [...repository.reservations.values()].reduce(
      (sum, reservation) => sum + (reservation.lines.rice?.reserved ?? 0),
      0,
    );
    expect(repository.stock.get('rice')).toBe(0);
    expect(reserved).toBe(5);
    expect(publisher.ofType('IngredientsReserved')).toHaveLength(5);
    expect(publisher.ofType('IngredientsShortage')).toHaveLength(15);
  });

  it('completes a waiting dish with its purchase', async () => {
    repository.stock.set('rice', 1);
    await warehouse.reserveIngredients(dishIds[0] as string, rice(3));

    await warehouse.receivePurchase(riceSold(2));

    expect(repository.stock.get('rice')).toBe(0);
    expect(publisher.ofType('IngredientsReserved')).toHaveLength(1);
  });

  it('puts what the dish does not need into stock', async () => {
    repository.stock.set('rice', 0);
    await warehouse.reserveIngredients(dishIds[0] as string, rice(2));

    await warehouse.receivePurchase(riceSold(5));

    expect(repository.stock.get('rice')).toBe(3);
    expect(repository.reservations.get(dishIds[0] as string)?.lines.rice?.reserved).toBe(2);
  });

  it('waits for more when a purchase covers only part of the shortfall', async () => {
    repository.stock.set('rice', 0);
    await warehouse.reserveIngredients(dishIds[0] as string, rice(3));

    await warehouse.receivePurchase(riceSold(2));

    expect(repository.reservations.get(dishIds[0] as string)?.lines.rice?.reserved).toBe(2);
    expect(publisher.ofType('IngredientsReserved')).toHaveLength(0);
  });

  it('applies a duplicated purchase only once', async () => {
    repository.stock.set('rice', 0);
    await warehouse.reserveIngredients(dishIds[0] as string, rice(2));
    const purchase = riceSold(4);

    await warehouse.receivePurchase(purchase);
    await warehouse.receivePurchase(purchase);

    expect(repository.stock.get('rice')).toBe(2);
  });
});
