import "server-only";

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

import { createClientFactory } from "@/lib/integrations/aws/client";
import { serverEnv } from "@/lib/config/env";
import type { KbDocumentInput } from "@/lib/kb/types";

interface TfStateResource {
  mode?: string;
  type?: string;
  name?: string;
  module?: string;
  provider?: string;
  instances?: unknown[];
}

interface TfState {
  version?: number;
  terraform_version?: string;
  serial?: number;
  lineage?: string;
  resources?: TfStateResource[];
}

function resolveBucketAccountId(): string | undefined {
  return process.env.AWS_MGMT_ACCOUNT_ID?.trim() || process.env.AWS_PROD_ACCOUNT_ID?.trim();
}

function formatTfStateSummary(state: TfState, key: string): string {
  const resources = state.resources ?? [];
  const managed = resources.filter((r) => r.mode === "managed" || !r.mode);

  const lines: string[] = [];
  lines.push(`Terraform state file: ${key}`);
  if (state.terraform_version) lines.push(`Terraform version: ${state.terraform_version}`);
  if (state.serial !== undefined) lines.push(`Serial: ${state.serial}`);
  lines.push(`Total resources: ${resources.length}`);
  lines.push(`Managed resources: ${managed.length}`);

  if (managed.length > 0) {
    lines.push("");
    lines.push("Managed resources:");
    for (const r of managed) {
      const parts: string[] = [];
      if (r.module) parts.push(`module=${r.module}`);
      parts.push(`${r.type ?? "unknown"}.${r.name ?? "unnamed"}`);
      lines.push(`  - ${parts.join(" / ")}`);
    }
  }

  return lines.join("\n");
}

async function fetchStateObject(
  s3: S3Client,
  bucket: string,
  key: string,
): Promise<KbDocumentInput | null> {
  try {
    const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(getCmd);
    const body = await response.Body?.transformToString("utf-8");
    if (body === undefined || body === null) return null;

    const state = JSON.parse(body) as TfState;
    const summary = formatTfStateSummary(state, key);

    return {
      source: "terraform_state",
      externalId: key,
      title: key,
      url: `s3://${bucket}/${key}`,
      content: summary,
      metadata: {
        bucket,
        key,
        terraformVersion: state.terraform_version,
        serial: state.serial,
        resourceCount: (state.resources ?? []).length,
      },
    };
  } catch (err) {
    console.error(`[kb/terraform] Failed to parse s3://${bucket}/${key}:`, err);
    return null;
  }
}

/**
 * Generate KB documents from Terraform state files stored in the configured S3 bucket.
 *
 * READ-ONLY: only ListObjectsV2 + GetObject are used.
 */
export async function listTerraformStateDocuments(): Promise<KbDocumentInput[]> {
  const accountId = resolveBucketAccountId();
  if (!accountId) {
    console.error("[kb/terraform] No AWS account configured for Terraform state bucket access");
    return [];
  }

  const env = serverEnv();
  const bucket = env.TERRAFORM_STATE_BUCKET;
  const factory = createClientFactory(accountId);
  const s3 = factory.get(S3Client);

  const documents: KbDocumentInput[] = [];

  try {
    let continuationToken: string | undefined;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const listed = await s3.send(listCmd);
      const objects = listed.Contents ?? [];
      continuationToken = listed.NextContinuationToken;

      for (const obj of objects) {
        const key = obj.Key;
        if (!key) continue;
        if (!key.endsWith(".tfstate")) continue;

        const doc = await fetchStateObject(s3, bucket, key);
        if (doc) documents.push(doc);
      }
    } while (continuationToken);

    return documents;
  } catch (err) {
    console.error("[kb/terraform] Failed to list Terraform state documents:", err);
    return [];
  }
}
