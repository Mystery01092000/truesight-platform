import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { vulnerabilityFindings } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { SEVERITIES } from "@/lib/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUERY = z.object({
  severity: z.enum(SEVERITIES).optional(),
  source: z.string().min(1).optional(),
  status: z.enum(["open", "fixed", "dismissed"]).optional(),
  urn: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/vulnerabilities — `security:read` — paginated read of the durable
 * `vulnerability_findings` table (per-finding lifecycle, unlike the snapshot
 * `security_posture`). Facet counts share the active filters so the UI's
 * severity/source chips reflect the current slice.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "security:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = QUERY.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { severity, source, status, urn, limit, offset } = parsed.data;
  const filters: SQL[] = [];
  if (severity) filters.push(eq(vulnerabilityFindings.severity, severity));
  if (source) filters.push(eq(vulnerabilityFindings.source, source));
  if (status) filters.push(eq(vulnerabilityFindings.status, status));
  if (urn) filters.push(eq(vulnerabilityFindings.urn, urn));
  const where = filters.length > 0 ? and(...filters) : undefined;

  const [findings, [totalRow], severityRows, sourceRows] = await Promise.all([
    db
      .select()
      .from(vulnerabilityFindings)
      .where(where)
      .orderBy(desc(severityWeight()), desc(vulnerabilityFindings.lastSeen))
      .limit(limit)
      .offset(offset),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(vulnerabilityFindings)
      .where(where),
    db
      .select({ severity: vulnerabilityFindings.severity, n: sql<number>`count(*)::int` })
      .from(vulnerabilityFindings)
      .where(where)
      .groupBy(vulnerabilityFindings.severity),
    db
      .select({ source: vulnerabilityFindings.source, n: sql<number>`count(*)::int` })
      .from(vulnerabilityFindings)
      .where(where)
      .groupBy(vulnerabilityFindings.source),
  ]);

  const severityFacet: Record<string, number> = {};
  for (const r of severityRows) severityFacet[r.severity ?? "unknown"] = r.n;
  const sourceFacet: Record<string, number> = {};
  for (const r of sourceRows) sourceFacet[r.source] = r.n;

  return NextResponse.json({
    findings,
    total: totalRow?.n ?? 0,
    facets: { severity: severityFacet, source: sourceFacet },
  });
}

/** Stable integer weight so critical sorts first regardless of text collation. */
function severityWeight() {
  return sql<number>`case ${vulnerabilityFindings.severity}
    when 'critical' then 5
    when 'high' then 4
    when 'medium' then 3
    when 'low' then 2
    when 'info' then 1
    else 0
  end`;
}
