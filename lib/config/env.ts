import "server-only";
import { z } from "zod";

/*
 * Lazy, request-time env access. We deliberately do NOT validate at module load —
 * `next build` imports server modules without runtime secrets present, so throwing
 * at import time would break the build. Call `serverEnv()` inside handlers/actions.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Auth — SESSION_SECRET is required in production; dev gets a clearly-fake default.
  SESSION_SECRET: z.string().min(16).default("truesight-dev-secret-change-me-in-prod"),
  ADMIN_EMAIL: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().optional(),

  // Azure AD (Entra) SSO — a dedicated app registration, distinct from the
  // estate service principal below.
  AZURE_SSO_TENANT_ID: z.string().optional(),
  AZURE_SSO_CLIENT_ID: z.string().optional(),
  AZURE_SSO_CLIENT_SECRET: z.string().optional(),

  // Data
  DATABASE_URL: z
    .string()
    .default("postgres://truesight:truesight@localhost:5432/truesight"),
  REDIS_URL: z.string().optional(),

  // AWS estate (read-only)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_MGMT_ACCOUNT_ID: z.string().optional(),
  AWS_PROD_ACCOUNT_ID: z.string().optional(),
  AWS_DEV_ACCOUNT_ID: z.string().optional(),
  AWS_PROD_ACCESS_KEY_ID: z.string().optional(),
  AWS_PROD_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_READONLY_ROLE_NAME: z.string().default("truesight-readonly"),

  // Azure
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_SUBSCRIPTION_NAME: z.string().default("Arcane-Prod"),
  AZURE_RESOURCE_GROUP: z.string().default("rg-arcane-prod"),

  // GitHub — owner may be an organization or a personal user account.
  GITHUB_OWNER: z.string().optional(),
  GITHUB_OWNER_TYPE: z.enum(["org", "user", "auto"]).default("auto"),
  /** Legacy alias for GITHUB_OWNER (still honored when GITHUB_OWNER is unset). */
  GITHUB_ORG: z.string().default("arcane"),
  GITHUB_PAT: z.string().optional(),

  // Terraform state (read-only)
  TERRAFORM_STATE_BUCKET: z.string().default("terraform-iac-data"),

  // Knowledge Base (semantic search)
  OPENAI_API_KEY: z.string().min(1).optional(),
  KB_BUCKET_NAME: z.string().default("knowledge-base-iac-truesight-backend"),
  KB_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  KB_EMBEDDING_PROVIDER: z.enum(["openai", "bedrock"]).default("openai"),
  KB_SYNC_SCHEDULE: z.string().optional(), // cron expression, e.g. "rate(10 minutes)"

  // Bedrock (embeddings + RAG generation)
  BEDROCK_REGION: z.string().default("ap-south-1"),
  BEDROCK_EMBEDDING_MODEL: z.string().default("amazon.titan-embed-text-v2:0"),
  BEDROCK_GENERATION_MODEL: z
    .string()
    .default("apac.anthropic.claude-sonnet-4-20250514-v1:0"),

  // Ticketing — Teams webhook + SMTP (optional, graceful no-op when unset)
  TEAMS_WEBHOOK_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default("587"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

/** Validate + return the server environment (cached after first call). */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const raw: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    AZURE_SSO_TENANT_ID: process.env.AZURE_SSO_TENANT_ID,
    AZURE_SSO_CLIENT_ID: process.env.AZURE_SSO_CLIENT_ID,
    AZURE_SSO_CLIENT_SECRET: process.env.AZURE_SSO_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_MGMT_ACCOUNT_ID: process.env.AWS_MGMT_ACCOUNT_ID,
    AWS_PROD_ACCOUNT_ID: process.env.AWS_PROD_ACCOUNT_ID,
    AWS_DEV_ACCOUNT_ID: process.env.AWS_DEV_ACCOUNT_ID,
    AWS_PROD_ACCESS_KEY_ID: process.env.AWS_PROD_ACCESS_KEY_ID,
    AWS_PROD_SECRET_ACCESS_KEY: process.env.AWS_PROD_SECRET_ACCESS_KEY,
    AWS_READONLY_ROLE_NAME: process.env.AWS_READONLY_ROLE_NAME,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_SUBSCRIPTION_NAME: process.env.AZURE_SUBSCRIPTION_NAME,
    AZURE_RESOURCE_GROUP: process.env.AZURE_RESOURCE_GROUP,
    GITHUB_OWNER: process.env.GITHUB_OWNER,
    GITHUB_OWNER_TYPE: process.env.GITHUB_OWNER_TYPE,
    GITHUB_ORG: process.env.GITHUB_ORG,
    GITHUB_PAT: process.env.GITHUB_PAT,
    TERRAFORM_STATE_BUCKET: process.env.TERRAFORM_STATE_BUCKET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    KB_BUCKET_NAME: process.env.KB_BUCKET_NAME,
    KB_EMBEDDING_MODEL: process.env.KB_EMBEDDING_MODEL,
    KB_EMBEDDING_PROVIDER: process.env.KB_EMBEDDING_PROVIDER,
    KB_SYNC_SCHEDULE: process.env.KB_SYNC_SCHEDULE,
    BEDROCK_REGION: process.env.BEDROCK_REGION,
    BEDROCK_EMBEDDING_MODEL: process.env.BEDROCK_EMBEDDING_MODEL,
    BEDROCK_GENERATION_MODEL: process.env.BEDROCK_GENERATION_MODEL,
    TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
  };
  // Treat empty-string values as unset so Zod `.default()`/`.optional()` apply.
  // Next.js inlines NEXT_PUBLIC_* at BUILD time; when a build arg is missing the value
  // bakes in as "" rather than undefined, which would fail `.url()` (and similar)
  // instead of falling back to the default. Runtime task-def values can't override an
  // inlined NEXT_PUBLIC_* constant, so this coercion is what keeps the app resilient.
  for (const key of Object.keys(raw)) if (raw[key] === "") raw[key] = undefined;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${parsed.error.issues
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
  }
  // Never run production on the development fallback secret.
  if (
    parsed.data.NODE_ENV === "production" &&
    parsed.data.SESSION_SECRET === "truesight-dev-secret-change-me-in-prod"
  ) {
    throw new Error("SESSION_SECRET must be set explicitly in production");
  }
  cached = parsed.data;
  return cached;
}
