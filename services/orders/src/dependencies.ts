import {
  EventBridgePublisher,
  createDocumentClient,
  createLogger,
  requiredEnv,
} from '@lunch/shared';
import { Kitchen } from './application/kitchen.js';
import { OrderQueries } from './application/order-queries.js';
import { DynamoOrderRepository } from './infrastructure/dynamo-order-repository.js';

const repository = new DynamoOrderRepository(createDocumentClient(), {
  orders: requiredEnv('ORDERS_TABLE'),
  dishes: requiredEnv('DISHES_TABLE'),
});

export const logger = createLogger('orders');
export const kitchen = new Kitchen(
  repository,
  new EventBridgePublisher(requiredEnv('EVENT_BUS_NAME')),
);
export const queries = new OrderQueries(repository);
