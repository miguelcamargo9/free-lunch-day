import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';
import type { z } from 'zod';
import type { Logger } from './logger.js';

export function createSqsHandler(
  processRecord: (record: SQSRecord) => Promise<void>,
  logger: Logger,
) {
  return async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const outcomes = await Promise.allSettled(
      event.Records.map(async (record) => processRecord(record)),
    );
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

export function createJsonQueueConsumer<TSchema extends z.ZodType>(
  schema: TSchema,
  handle: (message: z.infer<TSchema>) => Promise<void>,
  logger: Logger,
) {
  return createSqsHandler((record) => handle(schema.parse(JSON.parse(record.body))), logger);
}
