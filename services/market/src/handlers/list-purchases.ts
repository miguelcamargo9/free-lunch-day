import { httpHandler, jsonResponse } from '@lunch/shared';
import { logger, queries } from '../dependencies.js';

export const handler = httpHandler(logger, async () =>
  jsonResponse(200, await queries.listRecent()),
);
