import { z } from 'zod';
import { OrderQuantitySchema } from '@lunch/contracts';
import { httpHandler, jsonResponse, parseJsonBody } from '@lunch/shared';
import { kitchen, logger } from '../dependencies.js';

const CreateOrderBodySchema = z.object({ quantity: OrderQuantitySchema });

export const handler = httpHandler(logger, async (event) => {
  const { quantity } = parseJsonBody(event, CreateOrderBodySchema);
  const order = await kitchen.placeOrder(quantity);
  return jsonResponse(202, order);
});
