import type { IngredientQuantity } from '@lunch/contracts';

export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly ingredients: readonly [IngredientQuantity, ...IngredientQuantity[]];
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'chicken-rice',
    name: 'Arroz con pollo',
    ingredients: [
      { ingredient: 'rice', quantity: 2 },
      { ingredient: 'chicken', quantity: 1 },
      { ingredient: 'tomato', quantity: 1 },
      { ingredient: 'onion', quantity: 1 },
    ],
  },
  {
    id: 'cheeseburger',
    name: 'Hamburguesa con queso',
    ingredients: [
      { ingredient: 'meat', quantity: 1 },
      { ingredient: 'cheese', quantity: 1 },
      { ingredient: 'lettuce', quantity: 1 },
      { ingredient: 'tomato', quantity: 1 },
      { ingredient: 'onion', quantity: 1 },
      { ingredient: 'ketchup', quantity: 1 },
    ],
  },
  {
    id: 'lemon-chicken-salad',
    name: 'Ensalada de pollo al limón',
    ingredients: [
      { ingredient: 'chicken', quantity: 1 },
      { ingredient: 'lettuce', quantity: 2 },
      { ingredient: 'tomato', quantity: 1 },
      { ingredient: 'lemon', quantity: 1 },
    ],
  },
  {
    id: 'potato-gratin',
    name: 'Papas gratinadas',
    ingredients: [
      { ingredient: 'potato', quantity: 3 },
      { ingredient: 'cheese', quantity: 2 },
      { ingredient: 'onion', quantity: 1 },
    ],
  },
  {
    id: 'steak-and-potatoes',
    name: 'Carne asada con papas',
    ingredients: [
      { ingredient: 'meat', quantity: 2 },
      { ingredient: 'potato', quantity: 2 },
      { ingredient: 'lemon', quantity: 1 },
    ],
  },
  {
    id: 'beef-rice-bowl',
    name: 'Bowl de carne y arroz',
    ingredients: [
      { ingredient: 'meat', quantity: 1 },
      { ingredient: 'rice', quantity: 2 },
      { ingredient: 'lettuce', quantity: 1 },
      { ingredient: 'tomato', quantity: 1 },
      { ingredient: 'ketchup', quantity: 1 },
    ],
  },
];

export function getRecipe(id: string): Recipe {
  const recipe = RECIPES.find((candidate) => candidate.id === id);
  if (!recipe) throw new Error(`Unknown recipe ${id}`);
  return recipe;
}

export function pickRandomRecipe(random: () => number = Math.random): Recipe {
  return RECIPES[Math.floor(random() * RECIPES.length)] as Recipe;
}
