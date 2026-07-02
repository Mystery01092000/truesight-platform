import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { desc, sql } from "drizzle-orm";

import { db } from "@/db";
import { securityPosture } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { cacheable } from "@/lib/cache";
import { runSecurityScan } from "@/lib/integrations/sync/security-sync";
import type { CloudProvider, Severity } from "@/lib/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/security — auth-guarded read of the captured security posture.
 * Returns findings (newest first, bounded) plus counts grouped by severity and
 * provider so the dashboard can render counters without a second round-trip.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "security:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = await cacheable("security:posture:list", 300, async () => {
    const rows = await db
      .select()
      .from(securityPosture)
      .orderBy(desc(severityWeight()), desc(securityPosture.capturedAt))
      .limit(500);

    const bySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    const byProvider: Partial<Record<CloudProvider, number>> = {};
    for (const r of rows) {
      if (r.severity) bySeverity[r.severity]++;
      if (r.provider) byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
    }

    return {
      findings: rows,
      counts: { bySeverity, byProvider, total: rows.length },
      lastScan: rows[0]?.capturedAt ?? null,
    };
  });

  return NextResponse.json(payload);
}

/**
 * POST /api/security — admin trigger for a full vulnerability scan across AWS,
 * Azure and GitHub. Read-only against the estate; the only write is into Argus's
 * own `security_posture` table.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "sync:trigger")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const summary = await runSecurityScan();

  // Reflect the fresh posture immediately on the security screen.
  revalidatePath("/security", "page");

  return NextResponse.json({ ok: true, summary });
}

/**
 * Order severities so critical surfaces first regardless of the column's text
 * collation. CASE maps to a stable integer weight; fall-through is 0 (info/unknown).
 */
function severityWeight() {
  return sql<number>`case ${securityPosture.severity}
    when 'critical' then 5
    when 'high' then 4
    when 'medium' then 3
    when 'low' then 2
    when 'info' then 1
    else 0
  end`;
}
