import { sql } from "drizzle-orm";
import { getSession, can } from "@/lib/auth";
import { db } from "@/db";
import { integrationAccounts, resources, resourceEdges } from "@/db/schema";
import { TOPO_ENV_SCOPES, type TopoEnvScope } from "@/lib/topology/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeScope(v: string | null): TopoEnvScope {
  return (TOPO_ENV_SCOPES as readonly string[]).includes(v ?? "")
    ? (v as TopoEnvScope)
    : "prod";
}

/**
 * Server-Sent Events stream of topology discovery progress. The canvas opens an
 * EventSource here on mount and drives its entrance choreography from the
 * staged events — groups resolve, then resources, then edges — before the `done`
 * event reveals the woven graph. Held behind the app auth gate (proxy.ts
 * protects /api/*), and explicitly re-checked for `topology:read`.
 *
 * Counts come from lightweight queries (not a full `getTopology` rebuild) so the
 * progress numbers reflect the real estate without doubling DB load. A ~25s
 * heartbeat keeps the ALB from reaping the connection.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session || !can(session.role, "topology:read")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const scope = normalizeScope(url.searchParams.get("env"));
  const scopeAll = scope === "all";
  const like = `${scope}%`;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Controller closed (client gone).
        }
      };
      const cleanup = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      send(": connected\n\n");

      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        // ── Stage 1: groups (cloud accounts) ──
        const accountRows = await db.select().from(integrationAccounts);
        const totalAccounts = accountRows.length;
        for (let i = 1; i <= totalAccounts; i++) {
          send(`event: progress\ndata: ${JSON.stringify({ stage: "groups", done: i, total: totalAccounts })}\n\n`);
          await wait(60);
        }

        // ── Stage 2: resources ──
        const resourceCount = (await db.execute(sql`
          select count(*)::int as n
          from resources
          where present = true
            and ${scopeAll ? sql`true` : sql`lower(coalesce(environment, '')) like ${like}`}
        `)) as unknown as { n: number }[];
        const totalResources = resourceCount[0]?.n ?? 0;
        const resBatches = Math.min(8, Math.max(1, Math.ceil(totalResources / 50)));
        for (let i = 1; i <= resBatches; i++) {
          send(`event: progress\ndata: ${JSON.stringify({ stage: "resources", done: i, total: resBatches })}\n\n`);
          await wait(70);
        }

        // ── Stage 3: edges (dependency weave) ──
        const edgeRows = await db.select().from(resourceEdges);
        const totalEdges = edgeRows.length;
        const edgeBatches = Math.min(6, Math.max(1, Math.ceil(totalEdges / 80)));
        for (let i = 1; i <= edgeBatches; i++) {
          send(`event: progress\ndata: ${JSON.stringify({ stage: "edges", done: i, total: edgeBatches })}\n\n`);
          await wait(60);
        }

        send('event: done\ndata: {"status":"complete"}\n\n');
      } catch {
        // DB unavailable — emit done so the client falls through to reveal.
        send('event: done\ndata: {"status":"error"}\n\n');
      }

      heartbeat = setInterval(() => send(": heartbeat\n\n"), 25_000);
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
