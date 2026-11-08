import { z } from 'zod';
import {
  DishIdSchema,
  IngredientListSchema,
  IngredientSchema,
  MAX_DISHES_PER_ORDER,
  OrderIdSchema,
  PurchaseIdSchema,
  RecipeIdSchema,
} from '../domain.js';
import { EVENT_SOURCES, defineEvent } from '../event.js';

const positiveInt = z.number().int().positive();

const DishRefSchema = z.object({
  dishId: DishIdSchema,
  orderId: OrderIdSchema,
  recipeId: RecipeIdSchema,
});

// ── orders (kitchen) ─────────────────────────────────────────────────────────

export const OrderBatchRequested = defineEvent({
  detailType: 'OrderBatchRequested',
  source: EVENT_SOURCES.orders,
  version: 1,
  payload: z.object({
    orderId: OrderIdSchema,
    quantity: positiveInt.max(MAX_DISHES_PER_ORDER),
  }),
});

export const DishCreated = defineEvent({
  detailType: 'DishCreated',
  source: EVENT_SOURCES.orders,
  version: 1,
  payload: DishRefSchema,
});

export const IngredientsRequested = defineEvent({
  detailType: 'IngredientsRequested',
  source: EVENT_SOURCES.orders,
  version: 1,
  payload: z.object({ dishId: DishIdSchema, ingredients: IngredientListSchema }),
});

export const DishPrepared = defineEvent({
  detailType: 'DishPrepared',
  source: EVENT_SOURCES.orders,
  version: 1,
  payload: DishRefSchema,
});

export const DishDelivered = defineEvent({
  detailType: 'DishDelivered',
  source: EVENT_SOURCES.orders,
  version: 1,
  payload: DishRefSchema,
});

// ── warehouse ────────────────────────────────────────────────────────────────

export const IngredientsShortage = defineEvent({
  detailType: 'IngredientsShortage',
  source: EVENT_SOURCES.warehouse,
  version: 1,
  payload: z.object({ dishId: DishIdSchema, missing: IngredientListSchema }),
});

export const IngredientsReserved = defineEvent({
  detailType: 'IngredientsReserved',
  source: EVENT_SOURCES.warehouse,
  version: 1,
  payload: z.object({ dishId: DishIdSchema, ingredients: IngredientListSchema }),
});

// ── market ───────────────────────────────────────────────────────────────────

const PurchaseAttemptSchema = z.object({
  purchaseId: PurchaseIdSchema,
  dishId: DishIdSchema,
  ingredient: IngredientSchema,
  requested: positiveInt,
  attempt: positiveInt,
});

export const IngredientPurchased = defineEvent({
  detailType: 'IngredientPurchased',
  source: EVENT_SOURCES.market,
  version: 1,
  payload: PurchaseAttemptSchema.extend({ quantitySold: positiveInt }),
});

export const IngredientUnavailable = defineEvent({
  detailType: 'IngredientUnavailable',
  source: EVENT_SOURCES.market,
  version: 1,
  payload: PurchaseAttemptSchema.extend({ retryInSeconds: z.number().int().nonnegative() }),
});

/** Every event in the system; detail types are unique (enforced by tests). */
export const LUNCH_EVENTS = [
  OrderBatchRequested,
  DishCreated,
  IngredientsRequested,
  DishPrepared,
  DishDelivered,
  IngredientsShortage,
  IngredientsReserved,
  IngredientPurchased,
  IngredientUnavailable,
] as const;

export type LunchEventDefinition = (typeof LUNCH_EVENTS)[number];
export type LunchEventType = LunchEventDefinition['detailType'];

export function findEventDefinition(detailType: string): LunchEventDefinition | undefined {
  return LUNCH_EVENTS.find((definition) => definition.detailType === detailType);
}
