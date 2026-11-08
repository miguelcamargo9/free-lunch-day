import { beforeEach, describe, expect, it } from 'vitest';
import { RecordingPublisher, fixedClock } from '@lunch/shared/testing';
import { Kitchen } from '../src/application/kitchen.js';
import { OrderQueries } from '../src/application/order-queries.js';
import { RECIPES, type Recipe } from '../src/domain/recipes.js';
import { InMemoryOrderRepository } from './in-memory-order-repository.js';

const firstRecipe = RECIPES[0] as Recipe;

describe('Kitchen', () => {
  let repository: InMemoryOrderRepository;
  let publisher: RecordingPublisher;
  let kitchen: Kitchen;
  let queries: OrderQueries;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
    publisher = new RecordingPublisher();
    kitchen = new Kitchen(repository, publisher, () => firstRecipe, fixedClock());
    queries = new OrderQueries(repository);
  });

  it('places an order and requests the batch asynchronously', async () => {
    const order = await kitchen.placeOrder(3);

    expect(repository.orders.get(order.orderId)?.quantity).toBe(3);
    expect(publisher.ofType('OrderBatchRequested')).toHaveLength(1);
    expect(repository.dishes.size).toBe(0);
  });

  it('creates every dish of a batch and requests its ingredients', async () => {
    const order = await kitchen.placeOrder(4);

    await kitchen.startBatch(order.orderId, 4);

    expect(repository.dishes.size).toBe(4);
    expect((await queries.findOrder(order.orderId))?.counts.PENDING).toBe(4);
    expect(publisher.ofType('DishCreated')).toHaveLength(4);
    const requested = publisher.ofType('IngredientsRequested')[0]?.detail.payload;
    expect(requested).toMatchObject({ ingredients: firstRecipe.ingredients });
  });

  it('does not duplicate dishes when a batch message is retried', async () => {
    const order = await kitchen.placeOrder(4);

    await kitchen.startBatch(order.orderId, 4);
    await kitchen.startBatch(order.orderId, 4);

    expect(repository.dishes.size).toBe(4);
    expect((await queries.findOrder(order.orderId))?.counts.PENDING).toBe(4);
  });

  it('prepares and delivers a dish once its ingredients are reserved', async () => {
    const order = await kitchen.placeOrder(1);
    await kitchen.startBatch(order.orderId, 1);
    const [dishId] = repository.dishes.keys();

    await kitchen.prepareAndDeliver(dishId as string);

    expect(repository.dishes.get(dishId as string)?.status).toBe('DELIVERED');
    expect((await queries.findOrder(order.orderId))?.counts).toEqual({
      PENDING: 0,
      WAITING_INGREDIENTS: 0,
      PREPARING: 0,
      DELIVERED: 1,
    });
    expect(publisher.ofType('DishDelivered')).toHaveLength(1);
  });

  it('delivering twice keeps the counts right', async () => {
    const order = await kitchen.placeOrder(1);
    await kitchen.startBatch(order.orderId, 1);
    const [dishId] = repository.dishes.keys();

    await kitchen.prepareAndDeliver(dishId as string);
    await kitchen.prepareAndDeliver(dishId as string);

    expect((await queries.findOrder(order.orderId))?.counts.DELIVERED).toBe(1);
  });
});
