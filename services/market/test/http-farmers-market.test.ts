import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpFarmersMarket } from '../src/infrastructure/http-farmers-market.js';

const buyUrl = 'https://market.test/api/buy';

function respondWith(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('HttpFarmersMarket', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the ingredient and returns the quantity sold', async () => {
    const fetchMock = respondWith(200, { quantitySold: 3 });

    await expect(new HttpFarmersMarket(buyUrl).buy('tomato')).resolves.toBe(3);
    expect(String(fetchMock.mock.calls[0]?.at(0))).toBe(`${buyUrl}?ingredient=tomato`);
  });

  it('fails on an error status so the job is retried', async () => {
    respondWith(503, {});

    await expect(new HttpFarmersMarket(buyUrl).buy('tomato')).rejects.toThrow('503');
  });

  it('fails on an unexpected body', async () => {
    respondWith(200, { sold: 'many' });

    await expect(new HttpFarmersMarket(buyUrl).buy('tomato')).rejects.toThrow();
  });
});
