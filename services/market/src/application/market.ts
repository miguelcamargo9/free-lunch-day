import {
  IngredientPurchased,
  IngredientUnavailable,
  createEvent,
  type IngredientQuantity,
} from '@lunch/contracts';
import { systemClock, uuidV5, type Clock, type EventPublisher } from '@lunch/shared';
import {
  leftoverAfter,
  remainingOf,
  retryDelaySeconds,
  type Purchase,
  type PurchaseJob,
  type PurchaseRequest,
} from '../domain/purchase.js';
import type { FarmersMarket, PurchaseJobQueue, PurchaseRepository } from './ports.js';

const REQUEST_ID_NAMESPACE = 'd1b6c3a2-7e4f-4b9a-8c5d-2f1e0a9b8c7d';
const PURCHASE_ID_NAMESPACE = 'e8f7a6b5-c4d3-4e2f-9a1b-0c9d8e7f6a5b';

const purchaseIdFor = (requestId: string, attempt: number) =>
  uuidV5(`${requestId}/${attempt}`, PURCHASE_ID_NAMESPACE);

export class Market {
  constructor(
    private readonly repository: PurchaseRepository,
    private readonly farmersMarket: FarmersMarket,
    private readonly jobs: PurchaseJobQueue,
    private readonly publisher: EventPublisher,
    private readonly now: Clock = systemClock,
    private readonly random: () => number = Math.random,
  ) {}

  async requestIngredients(dishId: string, missing: readonly IngredientQuantity[]) {
    await Promise.all(missing.map((item) => this.openRequest(dishId, item)));
  }

  async attemptPurchase({ requestId, attempt }: PurchaseJob): Promise<void> {
    const request = await this.repository.findRequest(requestId);
    if (!request) throw new Error(`Unknown purchase request ${requestId}`);
    if (request.attempts > attempt) return;
    // attempts === attempt means this job already bought but crashed before announcing it.
    const purchase =
      request.attempts === attempt
        ? await this.repository.findPurchase(purchaseIdFor(requestId, attempt))
        : await this.buy(request, attempt);
    if (purchase) await this.announce(purchase, request);
  }

  private async openRequest(dishId: string, { ingredient, quantity }: IngredientQuantity) {
    const at = this.now();
    const request = await this.repository.openRequest({
      requestId: uuidV5(`${dishId}/${ingredient}`, REQUEST_ID_NAMESPACE),
      dishId,
      ingredient,
      requested: quantity,
      purchased: 0,
      attempts: 0,
      scheduledAttempt: 0,
      createdAt: at,
      updatedAt: at,
    });
    await this.schedule(request, 1, 0);
  }

  private async buy(request: PurchaseRequest, attempt: number): Promise<Purchase | undefined> {
    if (request.attempts !== attempt - 1) {
      throw new Error(`Purchase job ${attempt} for ${request.requestId} arrived out of order`);
    }
    const requested = remainingOf(request);
    if (requested <= 0) return undefined;
    const quantitySold = await this.farmersMarket.buy(request.ingredient);
    const purchase: Purchase = {
      purchaseId: purchaseIdFor(request.requestId, attempt),
      requestId: request.requestId,
      dishId: request.dishId,
      ingredient: request.ingredient,
      requested,
      quantitySold,
      attempt,
      at: this.now(),
    };
    return (await this.repository.recordPurchase(request, purchase)) ? purchase : undefined;
  }

  private async announce(purchase: Purchase, request: PurchaseRequest): Promise<void> {
    const { purchaseId, dishId, ingredient, requested, attempt, quantitySold } = purchase;
    if (quantitySold > 0) {
      await this.publisher.publish([
        createEvent(
          IngredientPurchased,
          { purchaseId, dishId, ingredient, requested, attempt, quantitySold },
          dishId,
        ),
      ]);
      if (leftoverAfter(purchase) > 0) await this.schedule(request, attempt + 1, 0);
      return;
    }
    const retryInSeconds = retryDelaySeconds(attempt, this.random);
    await this.publisher.publish([
      createEvent(
        IngredientUnavailable,
        { purchaseId, dishId, ingredient, requested, attempt, retryInSeconds },
        dishId,
      ),
    ]);
    await this.schedule(request, attempt + 1, retryInSeconds);
  }

  // Marking after enqueueing keeps a crash safe (it re-enqueues) while replays never fork the chain.
  private async schedule(request: PurchaseRequest, attempt: number, delaySeconds: number) {
    if (request.scheduledAttempt >= attempt) return;
    await this.jobs.enqueue({ requestId: request.requestId, attempt }, delaySeconds);
    await this.repository.markScheduled(request.requestId, attempt);
  }
}
