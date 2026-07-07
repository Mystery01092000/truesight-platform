import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { integrationAccounts } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scan-frequency setting. Stored in the `integration_accounts.config` jsonb on a
 * dedicated platform row (provider `terraform`, external id `truesight-platform`) so it
 * persists without a schema migration. `scanFrequencyHours` is how often the
 * scheduled security scan runs.
 */
const PLATFORM_PROVIDER = "terraform" as const;
const PLATFORM_EXTERNAL_ID = "truesight-platform";
const DEFAULT_HOURS = 6;

interface PlatformConfig {
  scanFrequencyHours?: number;
}

async function readConfig(): Promise<PlatformConfig> {
  const [row] = await db
    .select({ config: integrationAccounts.config })
    .from(integrationAccounts)
    .where(
      and(
        eq(integrationAccounts.provider, PLATFORM_PROVIDER),
        eq(integrationAccounts.externalId, PLATFORM_EXTERNAL_ID),
      ),
    )
    .limit(1);
  const config = (row?.config ?? {}) as PlatformConfig;
  return config;
}

/** GET /api/settings/scan-frequency — returns the current scan interval (hours). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = await readConfig();
  return NextResponse.json({ scanFrequencyHours: config.scanFrequencyHours ?? DEFAULT_HOURS });
}

/** PUT /api/settings/scan-frequency — admin update of the scan interval. */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(session.role, "settings:write")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const raw = (body as { scanFrequencyHours?: unknown })?.scanFrequencyHours;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
    return NextResponse.json(
      { error: "scanFrequencyHours must be a number between 1 and 168" },
      { status: 400 },
    );
  }

  const existing = await readConfig();
  const nextConfig: PlatformConfig = { ...existing, scanFrequencyHours: Math.round(hours) };

  // Upsert the platform row so the setting survives without a pre-seeded record.
  await db
    .insert(integrationAccounts)
    .values({
      provider: PLATFORM_PROVIDER,
      externalId: PLATFORM_EXTERNAL_ID,
      displayName: "Truesight platform settings",
      config: nextConfig as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [integrationAccounts.provider, integrationAccounts.externalId],
      set: { config: nextConfig as unknown as Record<string, unknown> },
    });

  return NextResponse.json({ ok: true, scanFrequencyHours: nextConfig.scanFrequencyHours });
}
