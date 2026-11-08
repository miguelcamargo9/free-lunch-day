import { z } from 'zod';
import { createJsonQueueConsumer } from '@lunch/shared';
import { logger, market } from '../dependencies.js';

const PurchaseJobSchema = z.object({
  requestId: z.uuid(),
  attempt: z.number().int().positive(),
});

export const handler = createJsonQueueConsumer(
  PurchaseJobSchema,
  (job) => market.attemptPurchase(job),
  logger,
);
