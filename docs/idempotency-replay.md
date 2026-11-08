# Idempotency test: replaying every event

Every handler claims to be idempotent. This test checks it on the deployed system: it replays **every event ever published** from the EventBridge archive and compares the state before and after.

## How

1. `npm run check:consistency` (before).
2. `aws events start-replay` from the bus archive, covering the whole history (2026-11-08 04:50 → 05:33 UTC).
3. Wait until every queue and DLQ is empty.
4. `npm run check:consistency` (after).

[`scripts/check-consistency.ts`](../scripts/check-consistency.ts) reads the live tables and fails if any invariant breaks:

- **Stock conservation**, per ingredient: `5 + bought − reserved = stock`, and `stock ≥ 0`. Applying a purchase or a reservation twice would break it.
- Every order has exactly `quantity` dishes.
- No reservation holds more than its dish needs, and every delivered dish has a complete reservation.

## Result (2026-11-08, stage `dev`)

The replay invoked the consumers 131 times (orders 39, warehouse 52, market 12, purchase jobs 28).

| Metric                                                     | Before | After                            | Reading                                                                                  |
| ---------------------------------------------------------- | ------ | -------------------------------- | ---------------------------------------------------------------------------------------- |
| Orders / dishes                                            | 4 / 18 | 4 / 18                           | Replayed `OrderBatchRequested` created no extra dish                                     |
| Delivered                                                  | 15     | 18                               | 3 dishes stuck since before `market` existed received their shortage again and completed |
| Purchase attempts                                          | 46     | 51                               | Only those 3 dishes bought; replayed shortages of delivered dishes bought nothing        |
| Tomato, rice, onion, cheese, meat, chicken, lemon, ketchup | —      | unchanged                        | Replayed `IngredientPurchased` were not applied twice                                    |
| Potato / lettuce                                           | —      | +6 / +3 bought, +3 / +1 reserved | Exactly what the 3 stuck dishes still needed                                             |
| Invariants                                                 | hold   | hold                             | Stock conservation holds for all 10 ingredients; no DLQ message                          |

## Why it holds

| Event replayed         | Guard                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `OrderBatchRequested`  | Dish ids are UUIDv5 of `orderId/index`; creation is `attribute_not_exists`                          |
| `IngredientsRequested` | The reservation is opened once; stock moves only for what is still missing                          |
| `IngredientsShortage`  | Purchase request id is UUIDv5 of `dishId/ingredient`; `scheduledAttempt` stops a second retry chain |
| `IngredientPurchased`  | `appliedPurchases` on the reservation; the transaction fails if the id is already there             |
| `IngredientsReserved`  | Dish transitions are conditional on the current status and only move forward                        |
