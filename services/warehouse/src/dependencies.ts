import {
  EventBridgePublisher,
  createDocumentClient,
  createLogger,
  requiredEnv,
} from '@lunch/shared';
import { Warehouse } from './application/warehouse.js';
import { DynamoInventoryRepository } from './infrastructure/dynamo-inventory-repository.js';

const repository = new DynamoInventoryRepository(createDocumentClient(), {
  inventory: requiredEnv('INVENTORY_TABLE'),
  reservations: requiredEnv('RESERVATIONS_TABLE'),
});

export const logger = createLogger('warehouse');
export const warehouse = new Warehouse(
  repository,
  new EventBridgePublisher(requiredEnv('EVENT_BUS_NAME')),
);
