# ADR 0003 — Atomic, partial inventory reservations

- Status: accepted
- Date: 2026-11-07

## Context

The warehouse starts with 5 units per ingredient, and in a burst hundreds of dishes ask for them at once. Without concurrency control, two dishes read "there is 1 tomato", both deduct it and the stock goes negative. On top of that, the market may sell less than requested, or nothing.

## Decision

- Each ingredient is a DynamoDB item. Every deduction is a conditional write (`stock >= :n`), so stock can never go negative.
- A reservation is **partial**: a dish takes whatever is there and asks the market only for what it is missing.
- Purchased units **go first to the dish that asked for them**; any surplus goes to general stock.
- The reservation is the deduction the brief asks for ("deducted when prepared"): a dish moves to `PREPARING` only once everything is reserved.

## Consequences

- Throughput scales with parallel Lambdas; contention is limited to one item per ingredient.
- No deadlock: no dish waits for another to release stock, since every shortage is bought.
- No starvation: another dish cannot take a dish's purchase.
- Moving stock into a reservation is a two-item transaction, and transactions on a hot ingredient item can fail with `TransactionConflict` during a burst. Those are retried in-process with a few milliseconds of jittered backoff, then by SQS.
- A dish may hold reserved stock while it waits for the rest. That is acceptable: the market is an infinite source and the stock is used anyway.

## Rejected alternatives

- **All-or-nothing reservation with `TransactWriteItems`**: with 5 units and high demand almost every transaction would fail and retry, and each dish would end up buying its whole recipe.
- **A FIFO queue with a single group serializing the warehouse**: correct and simple, but it caps throughput at one consumer and makes the warehouse the bottleneck.
- **A distributed lock**: more moving parts and more latency than a conditional write, with no benefit.
