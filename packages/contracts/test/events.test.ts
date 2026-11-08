import { describe, expect, it } from 'vitest';
import {
  EVENT_SOURCES,
  IngredientPurchased,
  IngredientsRequested,
  LUNCH_EVENTS,
  MAX_DISHES_PER_ORDER,
  OrderBatchRequested,
  createEvent,
  findEventDefinition,
} from '../src/index.js';

const orderId = '0b6f5d1e-8c1a-4f7e-9a3b-2d4c6e8f0a12';
const dishId = '7c2e4a90-1b3d-4e5f-8a6b-9c0d1e2f3a4b';

describe('event registry', () => {
  it('has a unique detail type per event', () => {
    const types = LUNCH_EVENTS.map((definition) => definition.detailType);
    expect(new Set(types).size).toBe(types.length);
  });

  it('publishes every event from a known source', () => {
    const sources = Object.values(EVENT_SOURCES) as string[];
    for (const definition of LUNCH_EVENTS) expect(sources).toContain(definition.source);
  });

  it('finds a definition by detail type', () => {
    expect(findEventDefinition('IngredientsRequested')).toBe(IngredientsRequested);
    expect(findEventDefinition('Unknown')).toBeUndefined();
  });
});

describe('createEvent', () => {
  it('wraps a valid payload with routing fields and metadata', () => {
    const event = createEvent(OrderBatchRequested, { orderId, quantity: 3 }, orderId);

    expect(event.source).toBe(EVENT_SOURCES.orders);
    expect(event.detailType).toBe('OrderBatchRequested');
    expect(event.detail.payload).toEqual({ orderId, quantity: 3 });
    expect(event.detail.metadata).toMatchObject({ version: 1, correlationId: orderId });
    expect(event.detail.metadata.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(event.detail.metadata.occurredAt))).toBe(false);
  });

  it.each([0, -1, 1.5, MAX_DISHES_PER_ORDER + 1])('rejects an order of %s dishes', (quantity) => {
    expect(() => createEvent(OrderBatchRequested, { orderId, quantity }, orderId)).toThrow();
  });

  it('rejects an ingredient the market does not sell', () => {
    const ingredients = [{ ingredient: 'banana', quantity: 1 }];
    // @ts-expect-error -- 'banana' is not an Ingredient; runtime validation must also reject it
    expect(() => createEvent(IngredientsRequested, { dishId, ingredients }, dishId)).toThrow();
  });

  it('rejects an empty ingredient list', () => {
    expect(() => createEvent(IngredientsRequested, { dishId, ingredients: [] }, dishId)).toThrow();
  });

  it('rejects a purchase with nothing sold (that is IngredientUnavailable)', () => {
    const payload = {
      purchaseId: crypto.randomUUID(),
      dishId,
      ingredient: 'tomato' as const,
      requested: 2,
      attempt: 1,
      quantitySold: 0,
    };
    expect(() => createEvent(IngredientPurchased, payload, dishId)).toThrow();
  });
});
