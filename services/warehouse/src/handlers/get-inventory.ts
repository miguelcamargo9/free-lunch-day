import { httpHandler, jsonResponse } from '@lunch/shared';
import { logger, warehouse } from '../dependencies.js';

export const handler = httpHandler(logger, async () =>
  jsonResponse(200, await warehouse.listStock()),
);
