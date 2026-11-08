import { beforeEach, describe, expect, it } from 'vitest';
import { RecordingPublisher, fixedClock } from '@lunch/shared/testing';
import { Market } from '../src/application/market.js';
import { MAX_RETRY_DELAY_SECONDS, retryDelaySeconds } from '../src/domain/purchase.js';
import { InMemoryPurchaseRepository, RecordingJobQueue, ScriptedFarmersMarket } from './fakes.js';

const dishId = '7c2e4a90-1b3d-4e5f-8a6b-9c0d1e2f3a4b';

describe('retryDelaySeconds', () => {
  it('grows exponentially and is capped', () => {
    expect(retryDelaySeconds(1, () => 0)).toBe(1);
    expect(retryDelaySeconds(3, () => 0)).toBe(4);
    expect(retryDelaySeconds(3, () => 0.999)).toBe(8);
    expect(retryDelaySeconds(20, () => 0.999)).toBe(MAX_RETRY_DELAY_SECONDS);
  });
});

describe('Market', () => {
  let repository: InMemoryPurchaseRepository;
  let jobs: RecordingJobQueue;
  let publisher: RecordingPublisher;

  const marketSelling = (...sales: number[]) => {
    const farmersMarket = new ScriptedFarmersMarket(sales);
    const market = new Market(repository, farmersMarket, jobs, publisher, fixedClock(), () => 0);
    return { market, farmersMarket };
  };

  const runNextJob = async (market: Market) => {
    const next = jobs.jobs.shift();
    if (!next) throw new Error('no job queued');
    await market.attemptPurchase(next.job);
    return next;
  };

  beforeEach(() => {
    repository = new InMemoryPurchaseRepository();
    jobs = new RecordingJobQueue();
    publisher = new RecordingPublisher();
  });

  it('opens one request per missing ingredient, once', async () => {
    const { market } = marketSelling();
    const missing = [
      { ingredient: 'rice' as const, quantity: 2 },
      { ingredient: 'lemon' as const, quantity: 1 },
    ];

    await market.requestIngredients(dishId, missing);
    await market.requestIngredients(dishId, missing);

    expect(repository.requests.size).toBe(2);
    expect(jobs.jobs.map(({ job }) => job.attempt)).toEqual([1, 1]);
  });

  it('announces a purchase that covers the request and stops', async () => {
    const { market } = marketSelling(3);
    await market.requestIngredients(dishId, [{ ingredient: 'rice', quantity: 2 }]);

    await runNextJob(market);

    expect(publisher.ofType('IngredientPurchased')[0]?.detail.payload).toMatchObject({
      requested: 2,
      quantitySold: 3,
    });
    expect(jobs.jobs).toEqual([]);
  });

  it('keeps buying right away when the market sells less than needed', async () => {
    const { market } = marketSelling(1, 1);
    await market.requestIngredients(dishId, [{ ingredient: 'rice', quantity: 2 }]);

    await runNextJob(market);
    expect(jobs.jobs).toMatchObject([{ job: { attempt: 2 }, delaySeconds: 0 }]);
    await runNextJob(market);

    expect(publisher.ofType('IngredientPurchased')).toHaveLength(2);
    expect(jobs.jobs).toEqual([]);
  });

  it('retries later with backoff when nothing is sold', async () => {
    const { market } = marketSelling(0, 2);
    await market.requestIngredients(dishId, [{ ingredient: 'rice', quantity: 2 }]);

    await runNextJob(market);

    expect(publisher.ofType('IngredientUnavailable')[0]?.detail.payload).toMatchObject({
      retryInSeconds: 1,
    });
    expect(jobs.jobs).toMatchObject([{ job: { attempt: 2 }, delaySeconds: 1 }]);
    await runNextJob(market);
    expect(publisher.ofType('IngredientPurchased')).toHaveLength(1);
  });

  it('does not buy again when a job is delivered twice', async () => {
    const { market, farmersMarket } = marketSelling(2);
    await market.requestIngredients(dishId, [{ ingredient: 'rice', quantity: 2 }]);
    const { job } = await runNextJob(market);

    await market.attemptPurchase(job);

    expect(farmersMarket.calls).toHaveLength(1);
    expect(publisher.ofType('IngredientPurchased')).toHaveLength(2);
  });

  it('ignores a stale job from an earlier attempt', async () => {
    const { market, farmersMarket } = marketSelling(0, 1, 1);
    await market.requestIngredients(dishId, [{ ingredient: 'rice', quantity: 2 }]);
    const { job: first } = await runNextJob(market);
    await runNextJob(market);
    const published = publisher.published.length;

    await market.attemptPurchase(first);

    expect(farmersMarket.calls).toHaveLength(2);
    expect(publisher.published).toHaveLength(published);
  });

  it('does not fork the retry chain when a job is delivered twice', async () => {
    const { market } = marketSelling(1, 1);
    await market.requestIngredients(dishId, [{ ingredient: 'rice', quantity: 2 }]);
    const { job } = await runNextJob(market);

    await market.attemptPurchase(job);

    expect(jobs.jobs).toHaveLength(1);
  });
});
