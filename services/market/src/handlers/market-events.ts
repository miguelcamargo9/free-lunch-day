import { createEventConsumer } from '@lunch/shared';
import { logger, market } from '../dependencies.js';

export const handler = createEventConsumer(
  {
    IngredientsShortage: ({ payload }) =>
      market.requestIngredients(payload.dishId, payload.missing),
  },
  logger,
);
