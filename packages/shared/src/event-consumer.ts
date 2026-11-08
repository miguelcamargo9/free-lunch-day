import type { SQSRecord } from 'aws-lambda';
import { z } from 'zod';
import { findEventDefinition, type EventDetail, type LunchEventDefinition } from '@lunch/contracts';
import type { Logger } from './logger.js';
import { createSqsHandler } from './sqs-handler.js';

type EventHandler<TDefinition extends LunchEventDefinition> = (
  detail: EventDetail<TDefinition>,
) => Promise<void>;

export type EventHandlers = {
  [TDefinition in LunchEventDefinition as TDefinition['detailType']]?: EventHandler<TDefinition>;
};

const EventBridgeEnvelopeSchema = z.object({
  'detail-type': z.string(),
  detail: z.unknown(),
});

export function createEventConsumer(handlers: EventHandlers, logger: Logger) {
  return createSqsHandler(async (record: SQSRecord) => {
    const envelope = EventBridgeEnvelopeSchema.parse(JSON.parse(record.body));
    const detailType = envelope['detail-type'];
    const definition = findEventDefinition(detailType);
    const handler =
      definition && (handlers as Record<string, EventHandler<never> | undefined>)[detailType];
    if (!definition || !handler) {
      logger.warn('Ignoring event with no handler', { detailType });
      return;
    }
    const detail = definition.detail.parse(envelope.detail);
    try {
      await handler(detail as never);
    } catch (error) {
      throw new Error(`${detailType} failed for ${detail.metadata.correlationId}`, {
        cause: error,
      });
    }
  }, logger);
}
