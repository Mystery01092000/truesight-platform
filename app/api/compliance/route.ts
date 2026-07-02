import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { cacheable, invalidate } from "@/lib/cache";
import {
  getChecklistState,
  getComplianceSummary,
  setChecklistItemDone,
} from "@/lib/governance/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compliance API.
 *
 * GET  — `compliance:read` — returns the full compliance summary (framework
 *        breakdowns, drift/security totals, posture score) plus the verified
 *        checklist state (every item's pass/fail/warn resolved from real
 *        findings).
 *
 * PUT  — `checklist:write` — toggles a checklist item's `done` flag. This is
 *        the one manual write path; the verified state itself is always
 *        computed from live findings and is never written here.
 */

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "compliance:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // `security:` prefix so a security/estate sync invalidation busts this too.
  const payload = await cacheable("security:compliance:summary", 300, async () => {
    const [summary, checklist] = await Promise.all([
      getComplianceSummary(),
      getChecklistState(),
    ]);
    return { summary, checklist };
  });

  return NextResponse.json({ ok: true, ...payload });
}

const PUT_BODY = z.object({
  id: z.string().min(1),
  done: z.boolean(),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "checklist:write")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PUT_BODY.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await setChecklistItemDone(parsed.data.id, parsed.data.done);
  await invalidate("security:compliance:summary");
  return NextResponse.json({ ok: true });
}
