import { createEventConsumer } from '@lunch/shared';
import { logger, warehouse } from '../dependencies.js';

export const handler = createEventConsumer(
  {
    IngredientsRequested: ({ payload }) =>
      warehouse.reserveIngredients(payload.dishId, payload.ingredients),
  },
  logger,
);
