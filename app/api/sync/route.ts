import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { serverEnv } from "@/lib/config/env";
import { invalidate } from "@/lib/cache";
import { LANDING_STATS_CACHE_KEY } from "@/app/api/landing-stats/route";
import { createAwsAdapter } from "@/lib/integrations/aws";
import { runSync } from "@/lib/integrations/sync/orchestrator";
import type { IntegrationAdapter } from "@/lib/integrations/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trigger a read-only estate sync across the configured AWS accounts.
 * Admin-gated: requires an authenticated session with the `sync:trigger` capability.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(session.role, "sync:trigger")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const env = serverEnv();
  const adapters: IntegrationAdapter[] = [];
  if (env.AWS_MGMT_ACCOUNT_ID) {
    adapters.push(createAwsAdapter({ accountId: env.AWS_MGMT_ACCOUNT_ID, label: "AWS Management" }));
  }
  if (env.AWS_PROD_ACCOUNT_ID) {
    adapters.push(createAwsAdapter({ accountId: env.AWS_PROD_ACCOUNT_ID, label: "AWS Production" }));
  }
  if (adapters.length === 0) {
    return NextResponse.json({ error: "no AWS accounts configured" }, { status: 400 });
  }

  const summaries = await runSync({ adapters, trigger: "api" });

  // Reflect the fresh estate immediately: bust the public landing-stats cache and
  // re-render every authenticated RSC screen (overview, explorers, topology) so a
  // manual/scheduled sync is visible on the next load without waiting on a TTL.
  await invalidate(LANDING_STATS_CACHE_KEY);
  revalidatePath("/", "layout");

  return NextResponse.json({ ok: true, summaries });
}
