import "server-only";

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { terraformPlans, type NewTerraformPlan, type TerraformPlan } from "@/db/schema";
import { createClientFactory } from "@/lib/integrations/aws/client";
import { serverEnv } from "@/lib/config/env";

/**
 * Terraform plan-execution discovery — READ-ONLY sweep of the Terraform state
 * bucket. Only ListObjectsV2 is issued; artifacts are never fetched or mutated
 * (drift-safe: state stays referenced, not managed). Discovered objects are
 * upserted into `terraform_plans` keyed (bucket, key) so repeated sweeps stay
 * idempotent and the UI can serve from Postgres between refreshes.
 */

function resolveBucketAccountId(): string | undefined {
  return process.env.AWS_MGMT_ACCOUNT_ID?.trim() || process.env.AWS_PROD_ACCOUNT_ID?.trim();
}

/** Plan artifacts live under `plans/`, or are `.tfplan` / `.tfstate` objects anywhere. */
function isPlanArtifact(key: string): boolean {
  return key.startsWith("plans/") || key.endsWith(".tfplan") || key.endsWith(".tfstate");
}

/**
 * Infer `{env}/{service}/artifact` from the key path (after an optional leading
 * `plans/` segment). Shallow keys simply yield null env/service.
 */
function parseKeyPath(key: string): { name: string; env: string | null; service: string | null } {
  const segments = key.split("/").filter(Boolean);
  const name = segments[segments.length - 1] ?? key;
  const path = segments[0] === "plans" ? segments.slice(1) : segments;
  return {
    name,
    env: path.length >= 2 ? path[0] : null,
    service: path.length >= 3 ? path[1] : null,
  };
}

/**
 * Live-sweep the state bucket, upsert every plan artifact into `terraform_plans`,
 * and return the recent list. A sweep failure degrades to serving whatever is
 * already persisted rather than throwing at the route.
 */
export async function listPlanExecutions(): Promise<TerraformPlan[]> {
  const accountId = resolveBucketAccountId();
  if (!accountId) {
    console.error("[terraform/plans] No AWS account configured for Terraform state bucket access");
    return listRecentPlans();
  }

  const bucket = serverEnv().TERRAFORM_STATE_BUCKET;
  const factory = createClientFactory(accountId);
  const s3 = factory.get(S3Client);

  try {
    const rows: NewTerraformPlan[] = [];
    let continuationToken: string | undefined;

    do {
      const listed = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );
      continuationToken = listed.NextContinuationToken;

      for (const obj of listed.Contents ?? []) {
        const key = obj.Key;
        if (!key || !isPlanArtifact(key)) continue;
        const { name, env, service } = parseKeyPath(key);
        rows.push({
          bucket,
          key,
          name,
          env,
          service,
          sizeBytes: typeof obj.Size === "number" ? obj.Size : null,
          lastModified: obj.LastModified ?? null,
        });
      }
    } while (continuationToken);

    // Batch under Postgres' param cap; (bucket, key) is unique per sweep by construction.
    for (let i = 0; i < rows.length; i += 500) {
      await db
        .insert(terraformPlans)
        .values(rows.slice(i, i + 500))
        .onConflictDoUpdate({
          target: [terraformPlans.bucket, terraformPlans.key],
          set: {
            name: sql`excluded.name`,
            env: sql`excluded.env`,
            service: sql`excluded.service`,
            sizeBytes: sql`excluded.size_bytes`,
            lastModified: sql`excluded.last_modified`,
          },
        });
    }
  } catch (err) {
    console.error("[terraform/plans] bucket sweep failed:", err);
  }

  return listRecentPlans();
}

/** Persisted plan artifacts, newest first. */
export async function listRecentPlans(limit = 200): Promise<TerraformPlan[]> {
  return db
    .select()
    .from(terraformPlans)
    .orderBy(sql`${terraformPlans.lastModified} desc nulls last`)
    .limit(limit);
}
