import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import { securityPosture } from "@/db/schema";
import type { SecurityFinding, VulnScanResult } from "@/lib/integrations/security";
import { serverEnv } from "@/lib/config/env";

import { scanAwsVulns } from "@/lib/integrations/aws/vuln";
import { scanAzureVulns } from "@/lib/integrations/azure/vuln";
import { scanGithubVulns } from "@/lib/integrations/github/vuln";

type Db = PostgresJsDatabase<typeof schema>;

export interface SecurityScanSummary {
  ok: boolean;
  totalFindings: number;
  /** Per-provider counts. */
  byProvider: Record<string, number>;
  /** Per-provider/per-account partial-failure scopes. */
  errors: { provider: string; scope: string; message: string }[];
  /** ISO timestamp of when this scan's capture was written. */
  capturedAt: string;
}

export interface RunSecurityScanOptions {
  /**
   * Drizzle client. Optional so standalone scripts can pass their own connection;
   * the RSC `@/db` client is lazily imported when omitted.
   */
  db?: Db;
}

/**
 * Run every vulnerability adapter in parallel and upsert the merged findings into
 * `security_posture`. Each adapter is isolated: a total failure in one provider
 * never aborts the others, and the table is replaced atomically per scan so stale
 * resolved findings don't linger.
 *
 * READ-ONLY against the estate: every adapter issues list/get/describe operations
 * exclusively; the only write is into Argus's own Postgres.
 */
export async function runSecurityScan(
  opts: RunSecurityScanOptions = {},
): Promise<SecurityScanSummary> {
  const db: Db = opts.db ?? ((await import("@/db")).db as unknown as Db);
  const env = serverEnv();
  const capturedAt = new Date().toISOString();

  // Build the provider scan list from the configured estate. An absent provider
  // (no creds configured) simply contributes no findings rather than failing.
  const scanTasks: Array<{ provider: string; run: () => Promise<VulnScanResult> }> = [];

  if (env.AWS_MGMT_ACCOUNT_ID) {
    scanTasks.push({
      provider: "aws",
      run: () => scanAwsVulns({ accountId: env.AWS_MGMT_ACCOUNT_ID as string }),
    });
  }
  if (env.AWS_PROD_ACCOUNT_ID) {
    scanTasks.push({
      provider: "aws",
      run: () => scanAwsVulns({ accountId: env.AWS_PROD_ACCOUNT_ID as string }),
    });
  }

  // Azure needs all three SP env values; guard so a missing config is a no-op.
  if (env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET && env.AZURE_TENANT_ID) {
    scanTasks.push({ provider: "azure", run: () => scanAzureVulns() });
  }

  if (env.GITHUB_PAT) {
    scanTasks.push({ provider: "github", run: () => scanGithubVulns({ org: env.GITHUB_ORG }) });
  }

  const settled = await Promise.all(scanTasks.map((t) => t.run().catch(() => null)));

  const findings: SecurityFinding[] = [];
  const errors: SecurityScanSummary["errors"] = [];
  const byProvider: Record<string, number> = {};

  settled.forEach((res, i) => {
    const provider = scanTasks[i].provider;
    if (res === null) {
      errors.push({ provider, scope: `${provider}:scan`, message: "adapter threw" });
      return;
    }
    findings.push(...res.findings);
    byProvider[provider] = (byProvider[provider] ?? 0) + res.findings.length;
    for (const e of res.errors) errors.push({ provider, scope: e.scope, message: e.message });
  });

  await persistFindings(db, findings, capturedAt);

  return {
    ok: errors.length === 0,
    totalFindings: findings.length,
    byProvider,
    errors,
    capturedAt,
  };
}

/**
 * Replace the `security_posture` table with the latest scan, atomically.
 *
 * We DELETE the prior scan's rows inside the same transaction as the INSERT so a
 * crash mid-write never leaves the dashboard reading a half-populated table. The
 * DELETE is scoped to nothing fancier than a full wipe because findings are
 * re-derived wholesale every run — there is no per-finding "resolved" transition
 * to preserve, and a resolved finding simply no longer appears upstream.
 */
async function persistFindings(
  db: Db,
  findings: SecurityFinding[],
  capturedAt: string,
): Promise<void> {
  const rows = findings.map((f) => ({
    urn: f.urn,
    provider: f.provider,
    category: f.category,
    title: f.title,
    severity: f.severity,
    exposed: f.exposed,
    score: f.score ?? null,
    details: {
      resourceLink: f.details.resourceLink ?? null,
      remediation: f.details.remediation ?? null,
      description: f.details.description ?? null,
      ...stripMeta(f.details),
    },
    capturedAt: new Date(capturedAt),
  }));

  await db.transaction(async (tx) => {
    await tx.delete(securityPosture);
    if (rows.length > 0) {
      // Batch the insert so a very large finding set stays under Postgres' param cap.
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(securityPosture).values(rows.slice(i, i + 500));
      }
    }
  });
}

/** Strip the canonical keys so they're not duplicated in the persisted jsonb. */
function stripMeta(details: SecurityFinding["details"]): Record<string, unknown> {
  const { resourceLink, remediation, description, ...rest } = details;
  return rest;
}
