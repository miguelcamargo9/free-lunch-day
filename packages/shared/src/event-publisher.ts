import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import type { EventDefinition, OutgoingEvent } from '@lunch/contracts';
import { chunk, mapWithConcurrency } from './collections.js';

export type AnyOutgoingEvent = OutgoingEvent<EventDefinition>;

export interface EventPublisher {
  publish(events: readonly AnyOutgoingEvent[]): Promise<void>;
}

const MAX_ENTRIES_PER_CALL = 10;
const MAX_CALLS_IN_FLIGHT = 10;

export class EventBridgePublisher implements EventPublisher {
  constructor(
    private readonly eventBusName: string,
    private readonly client: EventBridgeClient = new EventBridgeClient({}),
  ) {}

  async publish(events: readonly AnyOutgoingEvent[]): Promise<void> {
    await mapWithConcurrency(chunk(events, MAX_ENTRIES_PER_CALL), MAX_CALLS_IN_FLIGHT, (batch) =>
      this.putBatch(batch),
    );
  }

  private async putBatch(batch: readonly AnyOutgoingEvent[]): Promise<void> {
    const result = await this.client.send(
      new PutEventsCommand({
        Entries: batch.map((event) => ({
          EventBusName: this.eventBusName,
          Source: event.source,
          DetailType: event.detailType,
          Detail: JSON.stringify(event.detail),
        })),
      }),
    );
    // Consumers are idempotent, so retrying the whole message is safe.
    if (result.FailedEntryCount) {
      const codes = (result.Entries ?? []).flatMap((entry) => entry.ErrorCode ?? []);
      throw new Error(
        `EventBridge rejected ${result.FailedEntryCount} events: ${codes.join(', ')}`,
      );
    }
  }
}
