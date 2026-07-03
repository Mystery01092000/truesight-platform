import { and, eq, inArray, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import { securityPosture, vulnerabilityFindings, type NewVulnerabilityFinding } from "@/db/schema";
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

  const settled = await Promise.allSettled(scanTasks.map((t) => t.run()));

  const findings: SecurityFinding[] = [];
  const errors: SecurityScanSummary["errors"] = [];
  const byProvider: Record<string, number> = {};

  settled.forEach((res, i) => {
    const provider = scanTasks[i].provider;
    if (res.status === "rejected") {
      const reason = res.reason as { message?: string };
      console.error(`[security-scan] ${provider} adapter failed wholesale:`, res.reason);
      errors.push({
        provider,
        scope: `${provider}:scan`,
        message: reason?.message ?? String(res.reason),
      });
      return;
    }
    findings.push(...res.value.findings);
    byProvider[provider] = (byProvider[provider] ?? 0) + res.value.findings.length;
    for (const e of res.value.errors) {
      errors.push({ provider, scope: e.scope, message: e.message });
    }
  });

  await persistFindings(db, findings, capturedAt);
  await persistVulnerabilityFindings(
    db,
    findings,
    resolveScannedSources(scanTasks, settled, errors),
    capturedAt,
  );

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

/* -------------------------------------------------------------------------- */
/* vulnerability_findings — durable per-finding lifecycle                     */
/* -------------------------------------------------------------------------- */

/**
 * Source labels each provider's adapter stamps into `details.source`, paired
 * with the error-scope prefixes that signal that stream did NOT fully scan.
 * A source is only eligible for the "not seen ⇒ fixed" sweep when every scope
 * belonging to it succeeded — otherwise a transient API failure would falsely
 * mark its open findings as fixed.
 */
const PROVIDER_SOURCES: Record<string, Array<{ source: string; scopePrefixes: string[] }>> = {
  aws: [
    { source: "inspector2", scopePrefixes: ["inspector2", "aws:scan"] },
    { source: "securityhub", scopePrefixes: ["securityhub", "aws:scan"] },
    // "ecr:" covers per-repo failures (scope `ecr:${region}:${repo}`) so a repo that
    // failed to enumerate never gets its open findings falsely swept to "fixed".
    { source: "ecr-image-scan", scopePrefixes: ["ecr-scans", "ecr:", "aws:scan"] },
  ],
  azure: [{ source: "defender", scopePrefixes: ["azure"] }],
  github: [
    { source: "dependabot", scopePrefixes: ["github:dependabot", "github:scan"] },
    { source: "codeql", scopePrefixes: ["github:codeql", "github:scan"] },
  ],
};

function resolveScannedSources(
  scanTasks: Array<{ provider: string }>,
  settled: Array<PromiseSettledResult<VulnScanResult>>,
  errors: SecurityScanSummary["errors"],
): string[] {
  const scanned = new Set<string>();
  settled.forEach((res, i) => {
    if (res.status === "rejected") return; // adapter threw wholesale — nothing scanned
    for (const { source } of PROVIDER_SOURCES[scanTasks[i].provider] ?? []) scanned.add(source);
  });
  for (const [provider, sources] of Object.entries(PROVIDER_SOURCES)) {
    for (const { source, scopePrefixes } of sources) {
      const failed = errors.some(
        (e) => e.provider === provider && scopePrefixes.some((p) => e.scope.startsWith(p)),
      );
      if (failed) scanned.delete(source);
    }
  }
  return [...scanned];
}

/**
 * Upsert this run's findings into `vulnerability_findings` keyed on
 * (source, externalId) — unlike `security_posture` this table keeps history:
 * rows re-seen get `lastSeen` bumped (and re-open if previously fixed), while
 * open rows from a fully-scanned source that did NOT resurface flip to `fixed`.
 */
async function persistVulnerabilityFindings(
  db: Db,
  findings: SecurityFinding[],
  scannedSources: string[],
  capturedAt: string,
): Promise<void> {
  const seenAt = new Date(capturedAt);

  // Dedupe on the conflict key so ON CONFLICT never updates a row twice in one batch.
  const byKey = new Map<string, NewVulnerabilityFinding>();
  for (const f of findings) {
    const source = typeof f.details.source === "string" ? f.details.source : f.provider;
    byKey.set(`${source} ${f.urn}`, {
      source,
      externalId: f.urn,
      urn: f.urn,
      severity: f.severity,
      title: f.title,
      description: f.details.description ?? null,
      mitigation: f.details.remediation ?? null,
      packageName: typeof f.details.package === "string" ? f.details.package : null,
      cve: typeof f.details.cveId === "string" ? f.details.cveId : null,
      resourceLink: f.details.resourceLink ?? null,
      status: "open",
      lastSeen: seenAt,
      metadata: {
        provider: f.provider,
        category: f.category,
        exposed: f.exposed,
        score: f.score ?? null,
      },
    });
  }
  const rows = [...byKey.values()];

  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(vulnerabilityFindings)
      .values(rows.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [vulnerabilityFindings.source, vulnerabilityFindings.externalId],
        set: {
          urn: sql`excluded.urn`,
          severity: sql`excluded.severity`,
          title: sql`excluded.title`,
          description: sql`excluded.description`,
          mitigation: sql`excluded.mitigation`,
          packageName: sql`excluded.package_name`,
          cve: sql`excluded.cve`,
          resourceLink: sql`excluded.resource_link`,
          status: sql`excluded.status`,
          lastSeen: sql`excluded.last_seen`,
          metadata: sql`excluded.metadata`,
        },
      });
  }

  if (scannedSources.length > 0) {
    await db
      .update(vulnerabilityFindings)
      .set({ status: "fixed" })
      .where(
        and(
          inArray(vulnerabilityFindings.source, scannedSources),
          eq(vulnerabilityFindings.status, "open"),
          lt(vulnerabilityFindings.lastSeen, seenAt),
        ),
      );
  }
}
