import { z } from 'zod';
import type { Ingredient } from '@lunch/contracts';
import type { FarmersMarket } from '../application/ports.js';

const BuyResponseSchema = z.object({ quantitySold: z.number().int().nonnegative() });

export class HttpFarmersMarket implements FarmersMarket {
  constructor(
    private readonly buyUrl: string,
    private readonly timeoutMs = 3000,
  ) {}

  async buy(ingredient: Ingredient): Promise<number> {
    const url = new URL(this.buyUrl);
    url.searchParams.set('ingredient', ingredient);
    const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) {
      throw new Error(`Farmers market answered ${response.status} for ${ingredient}`);
    }
    return BuyResponseSchema.parse(await response.json()).quantitySold;
  }
}
