import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import { z } from 'zod';
import { findEventDefinition, type EventDetail, type LunchEventDefinition } from '@lunch/contracts';
import type { Logger } from './logger.js';

type EventHandler<TDefinition extends LunchEventDefinition> = (
  detail: EventDetail<TDefinition>,
) => Promise<void>;

/** One optional, fully typed handler per event a service subscribes to. */
export type EventHandlers = {
  [TDefinition in LunchEventDefinition as TDefinition['detailType']]?: EventHandler<TDefinition>;
};

/** Shape of an EventBridge event once a rule delivers it to an SQS queue. */
const EventBridgeEnvelopeSchema = z.object({
  'detail-type': z.string(),
  detail: z.unknown(),
});

/**
 * Builds an SQS Lambda handler that validates each EventBridge event against its
 * contract and dispatches it. Failed records are reported individually
 * (ReportBatchItemFailures) so only they are retried and, eventually, sent to the DLQ.
 */
export function createEventConsumer(handlers: EventHandlers, logger: Logger) {
  const processRecord = async (record: SQSRecord): Promise<void> => {
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
    logger.appendKeys({ correlationId: detail.metadata.correlationId, detailType });
    try {
      await handler(detail as never);
    } finally {
      logger.removeKeys(['correlationId', 'detailType']);
    }
  };

  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const outcomes = await Promise.allSettled(event.Records.map(processRecord));
    const batchItemFailures = outcomes.flatMap((outcome, index) => {
      if (outcome.status === 'fulfilled') return [];
      const record = event.Records[index] as SQSRecord;
      logger.error('Failed to process message', {
        messageId: record.messageId,
        error: outcome.reason as Error,
      });
      return [{ itemIdentifier: record.messageId }];
    });
    return { batchItemFailures };
  };
}
