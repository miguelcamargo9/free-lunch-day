import {
  EventBridgePublisher,
  createDocumentClient,
  createLogger,
  requiredEnv,
} from '@lunch/shared';
import { Market } from './application/market.js';
import { PurchaseQueries } from './application/purchase-queries.js';
import { DynamoPurchaseRepository } from './infrastructure/dynamo-purchase-repository.js';
import { HttpFarmersMarket } from './infrastructure/http-farmers-market.js';
import { SqsPurchaseJobQueue } from './infrastructure/sqs-purchase-job-queue.js';

const repository = new DynamoPurchaseRepository(createDocumentClient(), {
  requests: requiredEnv('PURCHASE_REQUESTS_TABLE'),
  purchases: requiredEnv('PURCHASES_TABLE'),
  purchasesByTimeIndex: requiredEnv('PURCHASES_BY_TIME_INDEX'),
});

export const logger = createLogger('market');
export const market = new Market(
  repository,
  new HttpFarmersMarket(requiredEnv('FARMERS_MARKET_BUY_URL')),
  new SqsPurchaseJobQueue(requiredEnv('PURCHASE_JOBS_QUEUE_URL')),
  new EventBridgePublisher(requiredEnv('EVENT_BUS_NAME')),
);
export const queries = new PurchaseQueries(repository);
