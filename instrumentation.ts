/**
 * Next.js startup hook. Runs once per server process — wires the estate-event
 * cache invalidation listener so sync writes drop stale cached views.
 */
export async function register(): Promise<void> {
  // Server-only wiring (Postgres LISTEN, ioredis) must never load in the edge runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerCacheInvalidation } = await import("@/lib/cache/invalidation");
    await registerCacheInvalidation();
  }
}
