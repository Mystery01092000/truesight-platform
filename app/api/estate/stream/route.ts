import { subscribeEstate } from "@/lib/realtime/estate-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of estate changes.
 *
 * Clients (the authenticated screens) open a single EventSource to this route and
 * receive an `estate` event the instant a sync writes — pushed from Postgres
 * LISTEN/NOTIFY via the in-process fan-out (lib/realtime/estate-events). No polling.
 *
 * Held behind the app's auth gate (proxy.ts protects all /api/* except health/auth/
 * landing-stats), so only signed-in sessions can subscribe. A ~25s heartbeat comment
 * keeps the connection alive through the ALB idle timeout; the stream cleans up its
 * subscription + heartbeat on client disconnect.
 */
export async function GET(req: Request): Promise<Response> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller already closed (client gone) — ignore.
        }
      };

      const cleanup = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        unsubscribe?.();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Opening comment + a ready event so the client knows the stream is live.
      send(": connected\n\n");
      send('event: ready\ndata: {"type":"ready"}\n\n');

      try {
        unsubscribe = await subscribeEstate((evt) => {
          send(`event: estate\ndata: ${JSON.stringify(evt)}\n\n`);
        });
      } catch {
        // Listener unavailable (e.g. no DB) — the client falls back to interval refresh.
      }

      // Heartbeat keeps intermediaries (ALB) from reaping an idle connection.
      heartbeat = setInterval(() => send(": heartbeat\n\n"), 25_000);

      // Tear down when the client disconnects.
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy/CDN buffering so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
