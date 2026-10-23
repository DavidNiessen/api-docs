import { performance } from 'node:perf_hooks';
import type { Store } from 'express-rate-limit';

export interface DocumentationRateLimitOptions {
  /** Requests per client/subnet in a fixed window; default 600. */
  maxRequests?: number;
  /** Window duration in milliseconds; default 60,000. */
  windowMs?: number;
  /** Maximum remembered clients per adapter instance; default 10,000. */
  maxClients?: number;
}
interface State {
  totalHits: number;
  resetTime: Date;
}

/** A bounded, per-instance store with no timers or background resources. */
export class DocumentationRateLimiter implements Store {
  readonly localKeys = true;
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly maxClients: number;
  readonly #hits = new Map<string, number>();
  #deadline: number;

  constructor(
    options: DocumentationRateLimitOptions = {},
    private readonly now = () => performance.now(),
  ) {
    if (
      !options ||
      typeof options !== 'object' ||
      Array.isArray(options) ||
      Object.keys(options).some(
        (key) => !['maxRequests', 'windowMs', 'maxClients'].includes(key),
      )
    )
      throw new Error('Invalid documentation rate limit options');
    const integer = (
      key: keyof DocumentationRateLimitOptions,
      fallback: number,
      minimum: number,
      maximum: number,
    ) => {
      const selected = options[key];
      const value =
        Object.hasOwn(options, key) && selected !== undefined
          ? selected
          : fallback;
      if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
        throw new Error(`Invalid documentation rate limit ${key}`);
      return value;
    };
    this.maxRequests = integer('maxRequests', 600, 1, 1_000_000);
    this.windowMs = integer('windowMs', 60_000, 1_000, 86_400_000);
    this.maxClients = integer('maxClients', 10_000, 1, 100_000);
    this.#deadline = this.now() + this.windowMs;
  }

  #remaining() {
    const now = this.now();
    if (!Number.isFinite(now))
      throw new Error('Invalid documentation rate limit clock');
    if (now >= this.#deadline) {
      this.#hits.clear();
      this.#deadline = now + this.windowMs;
    }
    return this.#deadline - now;
  }

  increment(key: string): State {
    const resetTime = new Date(Date.now() + this.#remaining());
    if (
      typeof key !== 'string' ||
      !key.length ||
      key.length > 256 ||
      (!this.#hits.has(key) && this.#hits.size >= this.maxClients)
    )
      return { totalHits: this.maxRequests + 1, resetTime };
    const totalHits = Math.min(
      Number.MAX_SAFE_INTEGER,
      (this.#hits.get(key) ?? 0) + 1,
    );
    this.#hits.set(key, totalHits);
    return { totalHits, resetTime };
  }

  get(key: string): State | undefined {
    const resetTime = new Date(Date.now() + this.#remaining());
    const totalHits = this.#hits.get(key);
    return totalHits === undefined ? undefined : { totalHits, resetTime };
  }
  decrement(key: string) {
    this.#remaining();
    const totalHits = this.#hits.get(key);
    if (totalHits !== undefined) {
      if (totalHits <= 1) this.#hits.delete(key);
      else this.#hits.set(key, totalHits - 1);
    }
  }
  resetKey(key: string) {
    this.#remaining();
    this.#hits.delete(key);
  }
  resetAll() {
    this.#hits.clear();
    this.#deadline = this.now() + this.windowMs;
  }
  shutdown() {
    this.#hits.clear();
  }
  get clientCount() {
    this.#remaining();
    return this.#hits.size;
  }
}

export const rateLimitMessage =
  'Too many documentation requests. Try again later.';
