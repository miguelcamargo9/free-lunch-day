import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '@lunch/contracts';
import { canTransition, hasReached } from '../src/domain/dish.js';
import { RECIPES, getRecipe, pickRandomRecipe } from '../src/domain/recipes.js';

describe('recipes', () => {
  it('offers six recipes with unique ids', () => {
    expect(RECIPES).toHaveLength(6);
    expect(new Set(RECIPES.map((recipe) => recipe.id)).size).toBe(6);
  });

  it('uses every market ingredient across the menu', () => {
    const used = new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => i.ingredient)));
    expect([...used].sort()).toEqual([...INGREDIENTS].sort());
  });

  it('picks a recipe from the random number', () => {
    expect(pickRandomRecipe(() => 0)).toBe(RECIPES[0]);
    expect(pickRandomRecipe(() => 0.9999)).toBe(RECIPES[5]);
  });

  it('fails on an unknown recipe id', () => {
    expect(() => getRecipe('pizza')).toThrow('Unknown recipe pizza');
  });
});

describe('dish state machine', () => {
  it.each([
    ['PENDING', 'WAITING_INGREDIENTS', true],
    ['PENDING', 'PREPARING', true],
    ['WAITING_INGREDIENTS', 'PREPARING', true],
    ['PREPARING', 'DELIVERED', true],
    ['PENDING', 'DELIVERED', false],
    ['DELIVERED', 'PREPARING', false],
    ['PREPARING', 'WAITING_INGREDIENTS', false],
  ] as const)('%s → %s allowed: %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it('knows when a step already happened', () => {
    expect(hasReached('DELIVERED', 'PREPARING')).toBe(true);
    expect(hasReached('PREPARING', 'PREPARING')).toBe(true);
    expect(hasReached('PENDING', 'PREPARING')).toBe(false);
  });
});
