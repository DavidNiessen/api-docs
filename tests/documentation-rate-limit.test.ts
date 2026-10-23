import { expect, it } from 'vitest';
import { DocumentationRateLimiter } from '../integrations/node/src/rate-limit.js';

it('enforces quotas and rolls fixed windows using a monotonic clock', () => {
  let now = 0;
  const limiter = new DocumentationRateLimiter(
    { maxRequests: 2, windowMs: 1000 },
    () => now,
  );
  expect(limiter.increment('one').totalHits).toBe(1);
  expect(limiter.increment('one').totalHits).toBe(2);
  expect(limiter.increment('one').totalHits).toBe(3);
  expect(limiter.increment('other').totalHits).toBe(1);
  now = 1000;
  expect(limiter.increment('one').totalHits).toBe(1);
  expect(limiter.clientCount).toBe(1);
  expect(limiter.increment('one').resetTime.getTime()).toBeGreaterThan(
    Date.now(),
  );
});

it('bounds remembered clients without evicting active quotas or retaining rejected keys', () => {
  let now = 0;
  const limiter = new DocumentationRateLimiter(
    { maxRequests: 2, maxClients: 2 },
    () => now,
  );
  limiter.increment('one');
  limiter.increment('two');
  for (let index = 0; index < 10_000; index++)
    expect(limiter.increment('new-' + index).totalHits).toBe(3);
  expect(limiter.clientCount).toBe(2);
  expect(limiter.increment('one').totalHits).toBe(2);
  expect(limiter.increment('one').totalHits).toBe(3);
  expect(limiter.increment('x'.repeat(257)).totalHits).toBe(3);
  expect(limiter.increment('').totalHits).toBe(3);
  now += 60_000;
  expect(limiter.increment('new').totalHits).toBe(1);
  expect(limiter.clientCount).toBe(1);
});

it('supports the framework store reset/decrement contract without timers', () => {
  const limiter = new DocumentationRateLimiter();
  expect(limiter.get('one')).toBeUndefined();
  limiter.increment('one');
  limiter.increment('one');
  limiter.decrement('one');
  expect(limiter.get('one')?.totalHits).toBe(1);
  limiter.decrement('one');
  expect(limiter.get('one')).toBeUndefined();
  limiter.increment('two');
  limiter.resetKey('two');
  expect(limiter.clientCount).toBe(0);
  limiter.increment('three');
  limiter.resetAll();
  expect(limiter.clientCount).toBe(0);
  limiter.increment('four');
  limiter.shutdown();
  expect(limiter.clientCount).toBe(0);
});

it('refuses invalid quota settings instead of silently disabling protection', () => {
  for (const key of ['maxRequests', 'windowMs', 'maxClients'])
    for (const value of [0, -1, 0.5, NaN, Infinity, null, '600'])
      expect(
        () => new DocumentationRateLimiter({ [key]: value } as never),
      ).toThrow('Invalid documentation rate limit');
  for (const value of [
    null,
    [],
    { typo: 1 },
    { maxRequests: 1_000_001 },
    { windowMs: 86_400_001 },
    { maxClients: 100_001 },
  ])
    expect(() => new DocumentationRateLimiter(value as never)).toThrow(
      'Invalid documentation rate limit',
    );
  const inherited = Object.create({ maxRequests: 1 });
  expect(new DocumentationRateLimiter(inherited).maxRequests).toBe(600);
});
