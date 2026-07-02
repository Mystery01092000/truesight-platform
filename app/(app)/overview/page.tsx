import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Cable, GitBranch, ShieldAlert, Wallet } from "lucide-react";
import { desc, eq, ne, sql, inArray } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  resources,
  integrationAccounts,
  integrationSync,
  driftFindings,
  securityPosture,
  costSnapshots,
} from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { StatTile } from "@/components/ui/StatTile";
import { ProviderChip } from "@/components/ui/ProviderChip";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

async function count(table: PgTable): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return row?.n ?? 0;
}

export default async function OverviewPage() {
  const [
    resourceCount,
    accountCount,
    driftCount,
    securityCount,
    costRows,
    providerRows,
    lastSync,
  ] = await Promise.all([
    count(resources),
    count(integrationAccounts),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(driftFindings)
      .where(ne(driftFindings.classification, "in_sync"))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(securityPosture)
      .where(inArray(securityPosture.severity, ["critical", "high"]))
      .then((r) => r[0]?.n ?? 0),
    db
      .select({ total: sql<string>`sum(amount)::numeric(20,2)` })
      .from(costSnapshots)
      .where(sql`period_start >= date_trunc('month', now())`),
    db
      .select({ provider: resources.provider, n: sql<number>`count(*)::int` })
      .from(resources)
      .where(eq(resources.present, true))
      .groupBy(resources.provider),
    db
      .select()
      .from(integrationSync)
      .orderBy(desc(integrationSync.startedAt))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const monthlyCost = costRows[0]?.total ? parseFloat(costRows[0].total) : 0;
  const providers = providerRows.map((r) => r.provider);
  const providerHint =
    providers.length > 0
      ? providers.map((p) => p.toUpperCase()).join(" · ")
      : "No clouds connected";

  const stats = [
    {
      label: "Resources discovered",
      value: resourceCount,
      hint: providerHint,
      href: "/topology",
      icon: Boxes,
    },
    {
      label: "Integrations",
      value: accountCount,
      hint: "connected cloud accounts",
      href: "/aws",
      icon: Cable,
    },
    {
      label: "Drift findings",
      value: driftCount,
      hint: driftCount > 0 ? "needs attention" : "estate in sync",
      href: "/compliance",
      icon: GitBranch,
    },
    {
      label: "Security alerts",
      value: securityCount,
      hint: securityCount > 0 ? "critical + high" : "no critical findings",
      href: "/security",
      icon: ShieldAlert,
    },
  ];

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return "never";
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8">
          <h1 className="font-display text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Overview
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-mute">
            One pane across your DevOps lifecycle. Argus watches — read-only — and never
            changes your estate.
          </p>
        </header>
      </Reveal>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.04}>
            <Link href={s.href} className="block h-full" aria-label={`${s.label} — open`}>
              <StatTile
                label={s.label}
                value={s.value}
                icon={<s.icon strokeWidth={1.75} />}
                sparkline={
                  <span className="text-[12px] leading-[1.5] text-mute">{s.hint}</span>
                }
                className="h-full transition-colors duration-150 ease-smooth hover:border-hairline-emphasis"
              />
            </Link>
          </Reveal>
        ))}
      </div>

      {monthlyCost > 0 ? (
        <Reveal delay={0.16}>
          <Link href="/cost" className="mt-4 block" aria-label="Spend this month — open cost analysis">
            <StatTile
              label="Spend this month"
              value={monthlyCost}
              prefix="$"
              decimals={2}
              icon={<Wallet strokeWidth={1.75} />}
              sparkline={
                <span className="text-[12px] leading-[1.5] text-mute">View breakdown →</span>
              }
              className="transition-colors duration-150 ease-smooth hover:border-hairline-emphasis"
            />
          </Link>
        </Reveal>
      ) : null}

      <Reveal delay={0.2}>
        <Surface level={1} radius="lg" className="mt-4 p-6">
          {resourceCount === 0 ? (
            <div>
              <h2 className="font-display text-[18px] font-medium leading-[1.4] text-ink">
                Argus hasn&rsquo;t mapped this estate yet
              </h2>
              <p className="mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
                Point Argus at an AWS account or Azure subscription and it will map the estate
                read-only — resources, dependencies, drift, cost, and security — then paint it
                onto the topology canvas. Press{" "}
                <span className="font-mono text-on-dark">⌘K</span> to jump anywhere.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-[18px] font-medium leading-[1.4] text-ink">
                  Estate is live
                </h2>
                <p className="mt-1.5 text-[14px] leading-[1.6] text-body">
                  Last synced <span className="font-mono text-on-dark">{formatSyncTime(lastSync?.startedAt?.toISOString() ?? null)}</span>.
                  Argus is watching{" "}
                  <span className="font-mono text-on-dark">{resourceCount}</span> resources
                  across <span className="font-mono text-on-dark">{accountCount}</span> integrations.
                </p>
              </div>
              {providers.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {providers.map((p) => (
                    <ProviderChip key={p} provider={p} />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3 border-t border-hairline pt-4">
                <Link href="/topology" className="text-[13px] text-mute transition-colors hover:text-on-dark">
                  Topology canvas →
                </Link>
                <Link href="/aws" className="text-[13px] text-mute transition-colors hover:text-on-dark">
                  AWS estate →
                </Link>
                <Link href="/cost" className="text-[13px] text-mute transition-colors hover:text-on-dark">
                  Cost analysis →
                </Link>
                <Link href="/security" className="text-[13px] text-mute transition-colors hover:text-on-dark">
                  Security findings →
                </Link>
                <Link href="/compliance" className="text-[13px] text-mute transition-colors hover:text-on-dark">
                  Compliance posture →
                </Link>
              </div>
            </div>
          )}
        </Surface>
      </Reveal>
    </div>
  );
}
