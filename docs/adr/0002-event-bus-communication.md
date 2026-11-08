# ADR 0002 — Event-based communication: EventBridge + one SQS queue per consumer

- Status: accepted
- Date: 2026-11-07

## Context

Kitchen, warehouse and market move at very different speeds: the kitchen creates hundreds of dishes in a second, while the market answers slowly and sometimes sells nothing. If services call each other over HTTP, one slow service slows them all and a burst brings them down in a cascade.

## Decision

- One **EventBridge** bus (`lunch-bus`) carries every domain event defined in `packages/contracts`.
- Each consuming service has an **SQS queue with a DLQ** as its rule target. The Lambda reads from the queue, never straight from the bus.
- No service calls another over HTTP. The only HTTP entry points are the dashboard's (`POST /orders`, `POST /assistant`).

## Consequences

- Adding a consumer (for example `realtime`, or analytics) means adding a rule, without touching the producers.
- The queue decouples speeds: it absorbs bursts, retries and lets us cap the purchase Lambda's concurrency.
- Delivery is at least once: every handler must be idempotent.
- There is no global order between events, so logic cannot depend on it. The dish state machine relies on conditional writes.

## Rejected alternatives

- **Synchronous HTTP between services**: temporal coupling and cascading failures.
- **SNS + SQS**: works, but EventBridge's content filtering and native features (archive, replay, rules per `detail-type`) fit a domain bus better.
- **Kinesis**: per-partition ordering, but oversized here and with a fixed cost per shard.
