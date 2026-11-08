import { httpHandler, jsonResponse } from '@lunch/shared';
import { logger, queries } from '../dependencies.js';

export const handler = httpHandler(logger, () =>
  Promise.resolve(jsonResponse(200, queries.listRecipes())),
);
