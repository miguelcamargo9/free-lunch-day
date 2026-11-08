import {
  DishCreated,
  DishDelivered,
  DishPrepared,
  IngredientsRequested,
  OrderBatchRequested,
  createEvent,
  type DishStatus,
} from '@lunch/contracts';
import {
  mapWithConcurrency,
  systemClock,
  uuidV5,
  type Clock,
  type EventPublisher,
} from '@lunch/shared';
import { canTransition, hasReached, toDishRef, type Dish } from '../domain/dish.js';
import { newOrder, type Order } from '../domain/order.js';
import { getRecipe, pickRandomRecipe, type Recipe } from '../domain/recipes.js';
import type { OrderRepository } from './ports.js';

const DISH_ID_NAMESPACE = 'a3c1f6e2-5d4b-4c8a-9e7f-1b2d3c4e5f60';
const MAX_PARALLEL_WRITES = 25;

export class Kitchen {
  constructor(
    private readonly repository: OrderRepository,
    private readonly publisher: EventPublisher,
    private readonly pickRecipe: () => Recipe = pickRandomRecipe,
    private readonly now: Clock = systemClock,
  ) {}

  async placeOrder(quantity: number): Promise<Order> {
    const order = newOrder(crypto.randomUUID(), quantity, this.now());
    await this.repository.saveOrder(order);
    await this.publisher.publish([
      createEvent(OrderBatchRequested, { orderId: order.orderId, quantity }, order.orderId),
    ]);
    return order;
  }

  async startBatch(orderId: string, quantity: number): Promise<void> {
    const indexes = Array.from({ length: quantity }, (_, index) => index);
    const dishes = await mapWithConcurrency(indexes, MAX_PARALLEL_WRITES, (index) =>
      this.repository.createDish(this.newDish(orderId, index)),
    );
    await this.publisher.publish(
      dishes.flatMap((dish) => [
        createEvent(DishCreated, toDishRef(dish), dish.dishId),
        createEvent(
          IngredientsRequested,
          { dishId: dish.dishId, ingredients: [...getRecipe(dish.recipeId).ingredients] },
          dish.dishId,
        ),
      ]),
    );
  }

  async prepareAndDeliver(dishId: string): Promise<void> {
    const dish = await this.getDish(dishId);
    const delivered = await this.advance(await this.advance(dish, 'PREPARING'), 'DELIVERED');
    const ref = toDishRef(delivered);
    await this.publisher.publish([
      createEvent(DishPrepared, ref, dishId),
      createEvent(DishDelivered, ref, dishId),
    ]);
  }

  private newDish(orderId: string, index: number): Dish {
    const at = this.now();
    return {
      dishId: uuidV5(`${orderId}/${index}`, DISH_ID_NAMESPACE),
      orderId,
      recipeId: this.pickRecipe().id,
      status: 'PENDING',
      createdAt: at,
      updatedAt: at,
    };
  }

  private async advance(dish: Dish, to: DishStatus): Promise<Dish> {
    if (hasReached(dish.status, to)) return dish;
    if (!canTransition(dish.status, to)) {
      throw new Error(`Dish ${dish.dishId} cannot go from ${dish.status} to ${to}`);
    }
    const at = this.now();
    if (await this.repository.updateDishStatus(dish, to, at)) {
      return { ...dish, status: to, updatedAt: at };
    }
    // Lost a race with another worker: continue from the dish's current status.
    return this.advance(await this.getDish(dish.dishId), to);
  }

  private async getDish(dishId: string): Promise<Dish> {
    const dish = await this.repository.findDish(dishId);
    if (!dish) throw new Error(`Unknown dish ${dishId}`);
    return dish;
  }
}
