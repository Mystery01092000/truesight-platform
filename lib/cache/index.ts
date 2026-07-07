import "server-only";
import { serverEnv } from "@/lib/config/env";
import { RedisCacheDriver } from "./redis";

/**
 * Cache abstraction. A single Fargate task needs no distributed cache, so the default
 * is a real in-process TTL store. When REDIS_URL is set (multi-task scaling), the
 * Redis driver is selected instead — call sites (`cacheable`) never change.
 */
export interface CacheDriver {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delPrefix(prefix: string): Promise<void>;
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

  async delPrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }
}

// Persist across HMR / route invocations in a single process.
const globalForCache = globalThis as unknown as { __truesightCache?: CacheDriver };

function driver(): CacheDriver {
  if (!globalForCache.__truesightCache) {
    const redisUrl = serverEnv().REDIS_URL;
    globalForCache.__truesightCache = redisUrl
      ? new RedisCacheDriver(redisUrl)
      : new MemoryCacheDriver();
  }
  return globalForCache.__truesightCache;
}

export interface CacheableOptions<T> {
  /**
   * Return false to skip storing the fresh value — the caller still receives it, but
   * the next read re-fetches. Lets partially-failed pulls (e.g. a cost adapter that
   * lost one account) avoid pinning their degraded result for the whole TTL.
   */
  shouldCache?: (value: T) => boolean;
}

// In-flight dedup: concurrent misses on the same key share one fetcher run instead of
// stampeding the upstream (Cost Explorer bills per request). Cleared on settle either
// way so a rejected fetch never poisons later calls.
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Read-through cache: return the cached value for `key`, or run `fetcher`, store, return.
 * Shared by RSC pages and API route handlers so a cloud call is made once and reused.
 */
export async function cacheable<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  opts?: CacheableOptions<T>,
): Promise<T> {
  const cache = driver();
  const cached = await cache.get<T>(key);
  if (cached !== null) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const fetch = (async () => {
    const fresh = await fetcher();
    if (opts?.shouldCache?.(fresh) !== false) {
      await cache.set(key, fresh, ttlSeconds);
    }
    return fresh;
  })();
  inFlight.set(key, fetch);
  try {
    return await fetch;
  } finally {
    inFlight.delete(key);
  }
}

export async function invalidate(key: string): Promise<void> {
  await driver().del(key);
}

/** Drop every cached entry whose key starts with `prefix` (e.g. "cost:"). */
export async function invalidatePrefix(prefix: string): Promise<void> {
  await driver().delPrefix(prefix);
}
