import "server-only";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { createClientFactory } from "@/lib/integrations/aws/client";
import { kbConfig } from "./config";

function resolveBucketAccountId(): string | undefined {
  return process.env.AWS_MGMT_ACCOUNT_ID?.trim() || process.env.AWS_PROD_ACCOUNT_ID?.trim();
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string = "application/octet-stream",
  expiresInSeconds: number = 300
): Promise<string> {
  const accountId = resolveBucketAccountId();
  if (!accountId) {
    throw new Error("No AWS account configured for KB bucket access");
  }

  const { bucketName } = kbConfig();
  const factory = createClientFactory(accountId);
  const s3 = factory.get(S3Client);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
