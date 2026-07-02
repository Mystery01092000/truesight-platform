import "server-only";
import Redis from "ioredis";
import type { CacheDriver } from "./index";

/**
 * Redis-backed cache driver for multi-task deployments. Values are JSON with a
 * server-side TTL (`SET key val EX ttl`). Strictly fail-open: any Redis failure
 * (connect, read, write) is logged once per error type and treated as a cache
 * miss / no-op — the app must never 500 because Redis is down.
 */
export class RedisCacheDriver implements CacheDriver {
  private client: Redis | null = null;
  private loggedErrors = new Set<string>();

  constructor(private readonly url: string) {}

  private getClient(): Redis {
    if (!this.client) {
      // rediss:// URLs enable TLS automatically in ioredis. Offline queue is off and
      // retries are minimal so a down Redis fails fast instead of stalling requests.
      this.client = new Redis(this.url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
      });
      // An unhandled 'error' event would crash the process — route it through the
      // once-per-type logger instead.
      this.client.on("error", (err) => this.failOpen("connection", err));
    }
    return this.client;
  }

  /** Log a Redis failure once per error type, then continue as if it were a miss. */
  private failOpen(op: string, err: unknown): void {
    const code =
      (err as { code?: string })?.code ?? (err as Error)?.name ?? "UnknownError";
    if (this.loggedErrors.has(code)) return;
    this.loggedErrors.add(code);
    console.error(`[cache/redis] ${op} failed (${code}); failing open:`, err);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.getClient().get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.failOpen("get", err);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      // EX requires a positive integer.
      const ttl = Math.max(1, Math.round(ttlSeconds));
      await this.getClient().set(key, JSON.stringify(value), "EX", ttl);
    } catch (err) {
      this.failOpen("set", err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.getClient().del(key);
    } catch (err) {
      this.failOpen("del", err);
    }
  }

  async delPrefix(prefix: string): Promise<void> {
    try {
      const client = this.getClient();
      let cursor = "0";
      do {
        const [next, keys] = await client.scan(
          cursor,
          "MATCH",
          `${prefix}*`,
          "COUNT",
          500,
        );
        cursor = next;
        // UNLINK reclaims memory asynchronously — no blocking DEL on large batches.
        if (keys.length > 0) await client.unlink(...keys);
      } while (cursor !== "0");
    } catch (err) {
      this.failOpen("delPrefix", err);
    }
  }
}
