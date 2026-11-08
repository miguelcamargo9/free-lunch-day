import { z } from 'zod';

export const EVENT_SOURCES = {
  orders: 'lunch.orders',
  warehouse: 'lunch.warehouse',
  market: 'lunch.market',
} as const;
export type EventSource = (typeof EVENT_SOURCES)[keyof typeof EVENT_SOURCES];

export const EventMetadataSchema = z.object({
  eventId: z.uuid(),
  occurredAt: z.iso.datetime(),
  version: z.number().int().positive(),
  correlationId: z.string().min(1),
});
export type EventMetadata = z.infer<typeof EventMetadataSchema>;

interface EventSpec<TType extends string, TPayload extends z.ZodType> {
  readonly detailType: TType;
  readonly source: EventSource;
  readonly version: number;
  readonly payload: TPayload;
}

export function defineEvent<TType extends string, TPayload extends z.ZodType>(
  spec: EventSpec<TType, TPayload>,
) {
  return {
    ...spec,
    detail: z.object({ metadata: EventMetadataSchema, payload: spec.payload }),
  };
}

export type EventDefinition = ReturnType<typeof defineEvent>;
export type EventDetail<TDefinition extends EventDefinition> = z.infer<TDefinition['detail']>;
export type EventPayload<TDefinition extends EventDefinition> = EventDetail<TDefinition>['payload'];

export interface OutgoingEvent<TDefinition extends EventDefinition> {
  readonly source: EventSource;
  readonly detailType: TDefinition['detailType'];
  readonly detail: EventDetail<TDefinition>;
}

export function createEvent<TDefinition extends EventDefinition>(
  definition: TDefinition,
  payload: z.input<TDefinition['payload']>,
  correlationId: string,
): OutgoingEvent<TDefinition> {
  const metadata: EventMetadata = {
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    version: definition.version,
    correlationId,
  };
  return {
    source: definition.source,
    detailType: definition.detailType,
    detail: definition.detail.parse({ metadata, payload }) as EventDetail<TDefinition>,
  };
}
