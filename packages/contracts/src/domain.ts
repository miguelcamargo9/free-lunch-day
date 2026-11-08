import { z } from 'zod';

/** Ingredients the farmers market sells. Names must match its API exactly. */
export const INGREDIENTS = [
  'tomato',
  'lemon',
  'potato',
  'rice',
  'ketchup',
  'lettuce',
  'onion',
  'cheese',
  'meat',
  'chicken',
] as const;

export const IngredientSchema = z.enum(INGREDIENTS);
export type Ingredient = z.infer<typeof IngredientSchema>;

export const IngredientQuantitySchema = z.object({
  ingredient: IngredientSchema,
  quantity: z.number().int().positive(),
});
export type IngredientQuantity = z.infer<typeof IngredientQuantitySchema>;

export const IngredientListSchema = z.array(IngredientQuantitySchema).nonempty();

/** Allowed transitions are enforced by the orders service; see docs/ARCHITECTURE.md. */
export const DISH_STATUSES = ['PENDING', 'WAITING_INGREDIENTS', 'PREPARING', 'DELIVERED'] as const;
export const DishStatusSchema = z.enum(DISH_STATUSES);
export type DishStatus = z.infer<typeof DishStatusSchema>;

/** Upper bound for one click of the order button; larger events are split by the client. */
export const MAX_DISHES_PER_ORDER = 500;

export const OrderIdSchema = z.uuid();
export const DishIdSchema = z.uuid();
export const PurchaseIdSchema = z.uuid();
export const RecipeIdSchema = z.string().min(1);
