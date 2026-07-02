import "server-only";
import { subscribeEstate } from "@/lib/realtime/estate-events";
import { invalidatePrefix } from "./index";

/**
 * Estate-sync → cache invalidation bridge. A sync (Fargate task or /api/sync)
 * emits a pg_notify estate event; on receipt every derived-view cache prefix is
 * dropped so the next read recomputes from fresh rows. Events are infrequent
 * (sync cadence), so blanket prefix invalidation is cheap and always correct —
 * no per-event-type mapping to drift out of sync with emitters.
 */
const SYNC_PREFIXES = [
  "estate:",
  "topology:",
  "cost:",
  "security:",
  "developers:",
  "landing:",
];

// Survive Next.js dev HMR: register the subscription once per process.
const globalForInvalidation = globalThis as unknown as {
  __argusCacheInvalidation?: boolean;
};

/** Wire estate events to cache invalidation (idempotent; called from instrumentation). */
export async function registerCacheInvalidation(): Promise<void> {
  if (globalForInvalidation.__argusCacheInvalidation) return;
  globalForInvalidation.__argusCacheInvalidation = true;
  try {
    await subscribeEstate(() => {
      for (const prefix of SYNC_PREFIXES) {
        invalidatePrefix(prefix).catch((err) => {
          console.error(`[cache/invalidation] Failed to invalidate ${prefix}:`, err);
        });
      }
    });
  } catch (err) {
    // Best-effort, like the SSE listener: caches simply expire via TTL instead.
    globalForInvalidation.__argusCacheInvalidation = false;
    console.error("[cache/invalidation] Failed to subscribe to estate events:", err);
  }
}
