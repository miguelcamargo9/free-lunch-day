import { describe, expect, it } from 'vitest';
import { uuidV5 } from '../src/index.js';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('uuidV5', () => {
  it('matches the RFC 4122 reference value (Python uuid.uuid5)', () => {
    expect(uuidV5('python.org', DNS_NAMESPACE)).toBe('886313e1-3b8a-5372-9b90-0c9aee199e5d');
  });

  it('is deterministic per name', () => {
    expect(uuidV5('order-1/0', DNS_NAMESPACE)).toBe(uuidV5('order-1/0', DNS_NAMESPACE));
    expect(uuidV5('order-1/0', DNS_NAMESPACE)).not.toBe(uuidV5('order-1/1', DNS_NAMESPACE));
  });
});
