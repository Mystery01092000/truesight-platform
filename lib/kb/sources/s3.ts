import "server-only";

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

import { createClientFactory } from "@/lib/integrations/aws/client";
import { kbConfig } from "@/lib/kb/config";
import type { KbDocumentInput } from "@/lib/kb/types";

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".tf",
  ".hcl",
  ".jenkinsfile",
  ".dockerfile",
  ".yaml",
  ".yml",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function hasTextExtension(key: string): boolean {
  const lower = key.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function basename(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}

function resolveBucketAccountId(): string | undefined {
  return process.env.AWS_MGMT_ACCOUNT_ID?.trim() || process.env.AWS_PROD_ACCOUNT_ID?.trim();
}

/**
 * List text documents stored in the configured KB S3 bucket.
 *
 * READ-ONLY: only ListObjectsV2 + GetObject are used.
 */
export async function listKbDocuments(): Promise<KbDocumentInput[]> {
  const accountId = resolveBucketAccountId();
  if (!accountId) {
    console.error("[kb/s3] No AWS account configured for KB bucket access");
    return [];
  }

  const { bucketName } = kbConfig();
  const factory = createClientFactory(accountId);
  const s3 = factory.get(S3Client);

  const documents: KbDocumentInput[] = [];

  try {
    let continuationToken: string | undefined;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const listed = await s3.send(listCmd);
      const objects = listed.Contents ?? [];
      continuationToken = listed.NextContinuationToken;

      for (const obj of objects) {
        const key = obj.Key;
        if (!key) continue;
        if (!hasTextExtension(key)) continue;
        if ((obj.Size ?? 0) > MAX_SIZE_BYTES) continue;

        try {
          const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: key });
          const response = await s3.send(getCmd);
          const body = await response.Body?.transformToString("utf-8");

          if (body === undefined || body === null) continue;

          documents.push({
            source: "s3",
            externalId: key,
            title: basename(key),
            url: `s3://${bucketName}/${key}`,
            content: body,
            metadata: {
              size: obj.Size,
              lastModified: obj.LastModified?.toISOString(),
              etag: obj.ETag,
            },
          });
        } catch (inner) {
          console.error(`[kb/s3] Failed to fetch s3://${bucketName}/${key}:`, inner);
        }
      }
    } while (continuationToken);

    return documents;
  } catch (err) {
    console.error("[kb/s3] Failed to list KB documents:", err);
    return [];
  }
}
