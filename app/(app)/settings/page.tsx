import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { Settings, Lock, Plug } from "lucide-react";

import { db } from "@/db";
import { integrationAccounts, integrationSync, platformAdmins } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderChip } from "@/components/ui/ProviderChip";
import { cn } from "@/lib/utils/cn";
import { ScanFrequencyCard } from "./ScanFrequencyCard";
import { PlatformAdminsCard, type AdminRow } from "./PlatformAdminsCard";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** The dedicated platform-settings carrier row (see /api/settings/scan-frequency). */
const PLATFORM_PROVIDER = "terraform" as const;
const PLATFORM_EXTERNAL_ID = "argus-platform";
const DEFAULT_SCAN_HOURS = 6;

function dateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function relativeLabel(date: Date, now: Date): string {
  const ms = now.getTime() - date.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">{title}</h2>
      <p className="mt-1 text-[13px] leading-[1.5] text-mute">{sub}</p>
    </div>
  );
}

export default async function SettingsPage() {
  // Defense in depth — layout + proxy already gate the session; role is gated here.
  const session = await getSession();
  if (!session) redirect("/login");

  const header = (
    <Reveal>
      <header className="mb-8 flex items-start gap-3.5">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
          aria-hidden
        >
          <Settings size={22} strokeWidth={1.75} className="text-iris" />
        </span>
        <div>
          <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Settings
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-mute">
            Platform configuration — scan cadence, the admin allowlist, and integration health.
          </p>
        </div>
      </header>
    </Reveal>
  );

  // `settings:write` maps to exactly the admin role — the console is admin-only.
  if (!can(session.role, "settings:write")) {
    return (
      <div className="mx-auto max-w-4xl">
        {header}
        <Reveal delay={0.05}>
          <EmptyState
            icon={<Lock size={24} strokeWidth={1.5} />}
            title="Admin access required"
            description="Platform settings are limited to DevOps Super Admins. Ask an existing admin to add your email to the allowlist."
          />
        </Reveal>
      </div>
    );
  }

  const now = new Date();
  const [configRows, adminRows, accounts, syncRows] = await Promise.all([
    db
      .select({ config: integrationAccounts.config })
      .from(integrationAccounts)
      .where(
        and(
          eq(integrationAccounts.provider, PLATFORM_PROVIDER),
          eq(integrationAccounts.externalId, PLATFORM_EXTERNAL_ID),
        ),
      )
      .limit(1),
    db.select().from(platformAdmins).orderBy(asc(platformAdmins.createdAt)),
    db
      .select()
      .from(integrationAccounts)
      // Exclude the settings carrier row — it isn't a real integration.
      .where(ne(integrationAccounts.externalId, PLATFORM_EXTERNAL_ID))
      .orderBy(asc(integrationAccounts.provider), asc(integrationAccounts.externalId)),
    db
      .select({
        accountId: integrationSync.accountId,
        last: sql<
          Date | string | null
        >`max(coalesce(${integrationSync.finishedAt}, ${integrationSync.startedAt}))`,
      })
      .from(integrationSync)
      .groupBy(integrationSync.accountId),
  ]);

  const scanHours =
    ((configRows[0]?.config ?? {}) as { scanFrequencyHours?: number }).scanFrequencyHours ??
    DEFAULT_SCAN_HOURS;

  const admins: AdminRow[] = adminRows.map((a) => ({
    id: a.id,
    email: a.email,
    role: a.role,
    note: a.note,
    createdLabel: dateLabel(a.createdAt),
  }));

  const lastSyncByAccount = new Map<string, Date>();
  for (const row of syncRows) {
    if (row.last) lastSyncByAccount.set(row.accountId, new Date(row.last));
  }

  return (
    <div className="mx-auto max-w-4xl">
      {header}

      <div className="space-y-4">
        {/* ── (a) Scan frequency ─────────────────────────────────────── */}
        <Reveal delay={0.05}>
          <Surface level={1} radius="lg" className="p-5">
            <ScanFrequencyCard initialHours={scanHours} />
          </Surface>
        </Reveal>

        {/* ── (b) Platform admins ────────────────────────────────────── */}
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-5">
            <PlatformAdminsCard admins={admins} />
          </Surface>
        </Reveal>

        {/* ── (c) Integrations status ────────────────────────────────── */}
        <Reveal delay={0.15}>
          <Surface level={1} radius="lg" className="p-5">
            <SectionHeading
              title="Integrations"
              sub="Read-only connection status per integration account. Managed via environment configuration, never mutated here."
            />
            {accounts.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-hairline bg-surface-elevated px-4 py-6 text-[13px] leading-[1.5] text-mute">
                <Plug size={16} strokeWidth={1.75} aria-hidden />
                No integration accounts discovered yet — the first sync registers them here.
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-hairline">
                {accounts.map((account) => {
                  const lastSync = lastSyncByAccount.get(account.id);
                  return (
                    <li
                      key={account.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                    >
                      <ProviderChip provider={account.provider} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-mono text-[13px] leading-[1.5] text-body">
                        {account.externalId}
                      </span>
                      {account.displayName && (
                        <span className="hidden truncate text-[13px] leading-[1.5] text-mute sm:block">
                          {account.displayName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium leading-[1.4] tracking-[0.06em] text-mute">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            account.enabled ? "bg-positive" : "bg-stone",
                          )}
                          aria-hidden
                        />
                        {account.enabled ? "Enabled" : "Disabled"}
                      </span>
                      <span className="w-28 text-right font-mono text-[11px] leading-[1.4] text-ash tabular-nums">
                        {lastSync ? `synced ${relativeLabel(lastSync, now)}` : "never synced"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>
        </Reveal>
      </div>
    </div>
  );
}
