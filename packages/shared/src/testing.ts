import {
  CreateTableCommand,
  DynamoDBClient,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';
import { createDocumentClient } from './dynamo.js';
import type { AnyOutgoingEvent, EventPublisher } from './event-publisher.js';

export class RecordingPublisher implements EventPublisher {
  readonly published: AnyOutgoingEvent[] = [];

  publish(events: readonly AnyOutgoingEvent[]): Promise<void> {
    this.published.push(...events);
    return Promise.resolve();
  }

  ofType(detailType: string): AnyOutgoingEvent[] {
    return this.published.filter((event) => event.detailType === detailType);
  }
}

export function fixedClock(at = '2026-11-07T12:00:00.000Z'): () => string {
  return () => at;
}

const localDynamoConfig = {
  endpoint: process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000',
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
};

export type LocalTableDefinition = Omit<CreateTableCommandInput, 'TableName' | 'BillingMode'>;

export function localDynamo() {
  const admin = new DynamoDBClient(localDynamoConfig);
  return {
    client: createDocumentClient(localDynamoConfig),
    async createTable(definition: LocalTableDefinition): Promise<string> {
      const TableName = `test-${crypto.randomUUID()}`;
      await admin.send(
        new CreateTableCommand({ ...definition, TableName, BillingMode: 'PAY_PER_REQUEST' }),
      );
      return TableName;
    },
  };
}
