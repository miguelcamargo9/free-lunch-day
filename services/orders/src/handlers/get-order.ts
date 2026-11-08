import { OrderIdSchema } from '@lunch/contracts';
import { HttpError, httpHandler, jsonResponse } from '@lunch/shared';
import { logger, queries } from '../dependencies.js';

export const handler = httpHandler(logger, async (event) => {
  const orderId = OrderIdSchema.safeParse(event.pathParameters?.orderId);
  if (!orderId.success) throw new HttpError(400, 'orderId must be a UUID');
  const order = await queries.findOrder(orderId.data);
  if (!order) throw new HttpError(404, 'Order not found');
  return jsonResponse(200, order);
});
