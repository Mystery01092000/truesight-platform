import { NextResponse } from "next/server";

import type { TerraformPlan } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listPlanExecutions, listRecentPlans } from "@/lib/integrations/terraform/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/terraform/plans — plan-execution history sourced from the Terraform
 * state bucket. `?refresh=1` triggers a live READ-ONLY S3 sweep before serving;
 * otherwise the persisted `terraform_plans` table answers directly.
 *
 * Gated to admin|operator: `sync:trigger` is the RBAC action scoped to exactly
 * those two roles.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "sync:trigger")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    // Both paths return newest-first (ordered by lastModified desc, nulls last).
    const plans = refresh ? await listPlanExecutions() : await listRecentPlans();
    return NextResponse.json({ plans: plans.map(withDisplayName) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/terraform/plans] failed:", err);
    return NextResponse.json({ error: "plans_failed", message }, { status: 500 });
  }
}

/** "prod-webapp.tfplan" in "plans/prod/webapp/" → "prod webapp (webapp · prod)". */
function withDisplayName(p: TerraformPlan): TerraformPlan & { displayName: string } {
  const base = (p.name ?? p.key)
    .replace(/\.(tfplan|tfstate)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const scope = [p.service, p.env].filter(Boolean).join(" · ");
  return { ...p, displayName: scope ? `${base} (${scope})` : base };
}
