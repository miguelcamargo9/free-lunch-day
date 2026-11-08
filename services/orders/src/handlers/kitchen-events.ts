import { createEventConsumer } from '@lunch/shared';
import { kitchen, logger } from '../dependencies.js';

export const handler = createEventConsumer(
  {
    OrderBatchRequested: ({ payload }) => kitchen.startBatch(payload.orderId, payload.quantity),
    IngredientsShortage: ({ payload }) => kitchen.markWaiting(payload.dishId),
    IngredientsReserved: ({ payload }) => kitchen.prepareAndDeliver(payload.dishId),
  },
  logger,
);
