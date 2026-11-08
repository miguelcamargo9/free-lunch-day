import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it, vi } from 'vitest';
import { DishDelivered, IngredientsRequested, createEvent } from '@lunch/contracts';
import { createEventConsumer, createLogger } from '../src/index.js';

const dishId = '7c2e4a90-1b3d-4e5f-8a6b-9c0d1e2f3a4b';
const logger = createLogger('test');

function sqsEvent(...bodies: unknown[]): SQSEvent {
  return {
    Records: bodies.map((body, index) => ({ messageId: `m${index}`, body: JSON.stringify(body) })),
  } as SQSEvent;
}

function asEventBridge(event: { detailType: string; detail: unknown }) {
  return { 'detail-type': event.detailType, source: 'test', detail: event.detail };
}

const requested = createEvent(
  IngredientsRequested,
  { dishId, ingredients: [{ ingredient: 'rice', quantity: 2 }] },
  dishId,
);

describe('createEventConsumer', () => {
  it('dispatches a valid event to its typed handler', async () => {
    const handler = vi.fn(async () => {});
    const consume = createEventConsumer({ IngredientsRequested: handler }, logger);

    const response = await consume(sqsEvent(asEventBridge(requested)));

    expect(response.batchItemFailures).toEqual([]);
    expect(handler).toHaveBeenCalledWith(requested.detail);
  });

  it('acknowledges events the service does not handle', async () => {
    const delivered = createEvent(
      DishDelivered,
      { dishId, orderId: dishId, recipeId: 'chicken-rice' },
      dishId,
    );
    const consume = createEventConsumer({}, logger);

    const response = await consume(sqsEvent(asEventBridge(delivered)));

    expect(response.batchItemFailures).toEqual([]);
  });

  it('reports only the records that fail', async () => {
    const handler = vi.fn(async () => {});
    const consume = createEventConsumer({ IngredientsRequested: handler }, logger);
    const invalid = { 'detail-type': 'IngredientsRequested', detail: { payload: {} } };

    const response = await consume(sqsEvent(asEventBridge(requested), invalid, 'not-an-event'));

    expect(response.batchItemFailures).toEqual([
      { itemIdentifier: 'm1' },
      { itemIdentifier: 'm2' },
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reports a record whose handler throws', async () => {
    const consume = createEventConsumer(
      { IngredientsRequested: () => Promise.reject(new Error('boom')) },
      logger,
    );

    const response = await consume(sqsEvent(asEventBridge(requested)));

    expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'm0' }]);
  });
});
