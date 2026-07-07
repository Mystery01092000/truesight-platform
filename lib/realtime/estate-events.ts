import "server-only";
import { EventEmitter } from "node:events";
import postgres from "postgres";

/**
 * Estate change event bus — the server half of the realtime experience.
 *
 * A sync (scheduled Fargate task OR /api/sync) writes to Postgres and issues
 * `pg_notify('truesight_estate', …)`. Postgres NOTIFY is cross-connection, so a single
 * dedicated LISTEN connection per web task hears every write — regardless of which
 * task or CLI produced it — and fans it out in-process to every open SSE stream via
 * a Node EventEmitter. That keeps DB connections flat (ONE listener per process, not
 * one per subscriber) while giving clients true server-push.
 *
 * Everything is lazy and best-effort: the listener opens on first subscribe, and if
 * the DB is unreachable (e.g. `next build`) subscribers simply never receive events
 * — the client falls back to interval refresh, so realtime is strictly additive.
 */

const CHANNEL = "truesight_estate";

export interface EstateEvent {
  type: string;
  at: string;
  [key: string]: unknown;
}

interface Hub {
  emitter: EventEmitter;
  client: ReturnType<typeof postgres> | null;
  starting: Promise<void> | null;
}

// Survive Next.js dev HMR: one hub (and one LISTEN connection) per process.
const globalForHub = globalThis as unknown as { __truesightEstateHub?: Hub };

function hub(): Hub {
  if (!globalForHub.__truesightEstateHub) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0); // many concurrent SSE subscribers per process
    globalForHub.__truesightEstateHub = { emitter, client: null, starting: null };
  }
  return globalForHub.__truesightEstateHub;
}

/** Open the single dedicated LISTEN connection for this process (idempotent). */
async function ensureListening(): Promise<void> {
  const h = hub();
  if (h.client) return;
  if (h.starting) return h.starting;

  h.starting = (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) return; // no DB (e.g. build) — SSE stays quiet; client falls back to polling.
    // Dedicated connection kept out of the app pool. postgres.js auto-reconnects and
    // re-establishes the LISTEN if the connection drops (RDS failover, idle reap).
    const client = postgres(url, {
      max: 1,
      idle_timeout: 0,
      connection: { application_name: "truesight-estate-listen" },
      onnotice: () => {},
    });
    await client.listen(CHANNEL, (payload: string) => {
      let evt: EstateEvent;
      try {
        evt = JSON.parse(payload) as EstateEvent;
      } catch {
        evt = { type: "estate:changed", at: new Date().toISOString() };
      }
      h.emitter.emit("change", evt);
    });
    h.client = client;
  })();

  try {
    await h.starting;
  } finally {
    h.starting = null;
  }
}

/**
 * Subscribe to estate-change events. Starts the process-wide listener on first use
 * and returns an unsubscribe function the caller MUST invoke on disconnect.
 */
export async function subscribeEstate(
  onChange: (evt: EstateEvent) => void,
): Promise<() => void> {
  await ensureListening();
  const h = hub();
  h.emitter.on("change", onChange);
  return () => h.emitter.off("change", onChange);
}
