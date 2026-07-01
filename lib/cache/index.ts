import "server-only";
import { serverEnv } from "@/lib/config/env";

/**
 * Cache abstraction. A single Fargate task needs no distributed cache, so the default
 * is a real in-process TTL store. When the platform scales to >1 task, set REDIS_URL
 * and swap in a Redis driver — call sites (`cacheable`) never change.
 */
export interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// Persist across HMR / route invocations in a single process.
const globalForCache = globalThis as unknown as { __argusCache?: CacheDriver };

function driver(): CacheDriver {
  if (!globalForCache.__argusCache) {
    // REDIS_URL present → a Redis driver would slot in here (requires `ioredis`).
    // Until multi-task scaling, the in-process driver is the real, correct choice.
    void serverEnv().REDIS_URL;
    globalForCache.__argusCache = new MemoryCacheDriver();
  }
  return globalForCache.__argusCache;
}

/**
 * Read-through cache: return the cached value for `key`, or run `fetcher`, store, return.
 * Shared by RSC pages and API route handlers so a cloud call is made once and reused.
 */
export async function cacheable<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cache = driver();
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached;
  const fresh = await fetcher();
  await cache.set(key, fresh, ttlSeconds);
  return fresh;
}

export async function invalidate(key: string): Promise<void> {
  await driver().del(key);
}
