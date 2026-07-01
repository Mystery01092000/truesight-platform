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
  SESSION_SECRET: z.string().min(16).default("argus-dev-secret-change-me-in-prod"),
  ADMIN_EMAIL: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("akshatcentricity2026"),

  // Data
  DATABASE_URL: z
    .string()
    .default("postgres://argus:argus@localhost:5432/argus"),
  REDIS_URL: z.string().optional(),

  // AWS estate (read-only)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default("ap-south-1"),
  AWS_MGMT_ACCOUNT_ID: z.string().optional(),
  AWS_PROD_ACCOUNT_ID: z.string().optional(),
  AWS_DEV_ACCOUNT_ID: z.string().optional(),
  AWS_READONLY_ROLE_NAME: z.string().default("argus-readonly"),

  // Azure
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_SUBSCRIPTION_NAME: z.string().default("Centricity-Oneinvictus"),
  AZURE_RESOURCE_GROUP: z.string().default("rg-centricity-prod"),

  // GitHub
  GITHUB_ORG: z.string().default("centricitywealthtech"),
  GITHUB_PAT: z.string().optional(),

  // Terraform state (read-only)
  TERRAFORM_STATE_BUCKET: z.string().default("terraform-iac-data"),
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
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
    AWS_MGMT_ACCOUNT_ID: process.env.AWS_MGMT_ACCOUNT_ID,
    AWS_PROD_ACCOUNT_ID: process.env.AWS_PROD_ACCOUNT_ID,
    AWS_DEV_ACCOUNT_ID: process.env.AWS_DEV_ACCOUNT_ID,
    AWS_READONLY_ROLE_NAME: process.env.AWS_READONLY_ROLE_NAME,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_SUBSCRIPTION_NAME: process.env.AZURE_SUBSCRIPTION_NAME,
    AZURE_RESOURCE_GROUP: process.env.AZURE_RESOURCE_GROUP,
    GITHUB_ORG: process.env.GITHUB_ORG,
    GITHUB_PAT: process.env.GITHUB_PAT,
    TERRAFORM_STATE_BUCKET: process.env.TERRAFORM_STATE_BUCKET,
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
  cached = parsed.data;
  return cached;
}
