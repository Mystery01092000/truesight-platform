import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getRun } from "@/lib/forge/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SSE tail of a run's log — polls the DB and pushes increments until terminal. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const session = await getSession();
  if (!session || !can(session.role, "forge:read")) return new Response("unauthorized", { status: 401 });
  const { runId } = await params;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      let sent = 0;
      const send = (event: string, data: string) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        for (let i = 0; i < 60 * 30; i++) {
          const run = await getRun(runId);
          if (!run) {
            send("end", "not-found");
            break;
          }
          if (run.log.length > sent) {
            send("log", run.log.slice(sent));
            sent = run.log.length;
          }
          if (run.status !== "running") {
            send("end", run.status);
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch {
        // Client disconnected or DB hiccup — close quietly; the run itself is unaffected.
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
