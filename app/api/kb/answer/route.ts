import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { answerQuestion, answerQuestionStream } from "@/lib/kb/answer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST_BODY = z.object({
  query: z.string().trim().min(1),
  stream: z.boolean().optional(),
  topK: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "kb:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = POST_BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { query, stream, topK } = parsed.data;

  try {
    if (stream) {
      const sse = await answerQuestionStream(query, { topK });
      return new Response(sse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const result = await answerQuestion(query, { topK });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/kb/answer] failed:", err);
    return NextResponse.json({ error: "answer_failed", message }, { status: 500 });
  }
}
