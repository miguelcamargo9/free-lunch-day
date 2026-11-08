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
