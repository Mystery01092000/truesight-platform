import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/db";
import { resources } from "@/db/schema";
import { getOrgLOCSummary, invalidateLOCCache } from "@/lib/integrations/github/loc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Developer Portal API.
 *
 * GET  — read-only org LOC metrics derived from GitHub's statistics API,
 *        guarded by `github:read`. Returns the discovered repo set plus the
 *        cached LOC summary (total LOC, contributors, languages, trend).
 * POST — admin/operator refresh: busts the LOC cache, rebuilds the summary,
 *        and revalidates the developers screen so a manual refresh is visible
 *        immediately.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "github:read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const [summary, [repoRow]] = await Promise.all([
      getOrgLOCSummary(),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(resources)
        .where(
          and(
            eq(resources.provider, "github"),
            eq(resources.type, "repo"),
            eq(resources.present, true),
          ),
        ),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        totalLOC: summary.totalLOC,
        totalAdditions: summary.totalAdditions,
        totalDeletions: summary.totalDeletions,
        repoCount: summary.repoCount,
        discoveredRepos: repoRow?.n ?? 0,
        contributorCount: summary.contributorCount,
        commitsThisMonth: summary.commitsThisMonth,
        repos: summary.repos,
        topContributors: summary.topContributors,
        languages: summary.languages,
        locTrend: summary.locTrend,
        partial: summary.partial,
        generatedAt: summary.generatedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/developers] failed:", err);
    return NextResponse.json({ error: "developers_failed", message }, { status: 500 });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "sync:trigger")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await invalidateLOCCache();
    const summary = await getOrgLOCSummary();
    revalidatePath("/developers", "page");

    return NextResponse.json({
      ok: true,
      data: {
        totalLOC: summary.totalLOC,
        repoCount: summary.repoCount,
        contributorCount: summary.contributorCount,
        commitsThisMonth: summary.commitsThisMonth,
        partial: summary.partial,
        generatedAt: summary.generatedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/developers] refresh failed:", err);
    return NextResponse.json({ error: "refresh_failed", message }, { status: 500 });
  }
}
