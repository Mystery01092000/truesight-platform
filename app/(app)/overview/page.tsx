import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  resources,
  integrationAccounts,
  integrationSync,
  driftFindings,
} from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

async function count(table: PgTable): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return row?.n ?? 0;
}

export default async function OverviewPage() {
  // Real state from the KB — zeros until an integration syncs (honest, not stubbed).
  const [resourceCount, accountCount, driftCount, lastSync] = await Promise.all([
    count(resources),
    count(integrationAccounts),
    count(driftFindings),
    db
      .select()
      .from(integrationSync)
      .orderBy(desc(integrationSync.startedAt))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const stats = [
    { label: "Resources discovered", value: resourceCount, hint: "across all connected clouds" },
    { label: "Integrations", value: accountCount, hint: "AWS · Azure · GitHub" },
    { label: "Drift findings", value: driftCount, hint: "state vs. live cloud" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8">
          <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Overview
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-mute">
            One pane across your DevOps lifecycle. Argus watches — read-only — and never
            changes your estate.
          </p>
        </header>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06}>
            <Surface level={1} radius="lg" className="p-5">
              <div className="text-[13px] text-mute">{s.label}</div>
              <div className="mt-2 text-[40px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                {s.value}
              </div>
              <div className="mt-2 text-[12px] text-mute">{s.hint}</div>
            </Surface>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <Surface level={1} radius="lg" className="mt-4 p-6">
          {resourceCount === 0 ? (
            <div>
              <h2 className="text-[18px] font-medium leading-[1.4] text-ink">
                Connect your first integration
              </h2>
              <p className="mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
                Argus hasn&rsquo;t discovered anything yet. Point it at an AWS account and it
                will map the estate read-only — resources, dependencies, drift and cost — then
                paint it onto the topology canvas. Press{" "}
                <span className="text-on-dark">⌘K</span> to jump anywhere.
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-[18px] font-medium leading-[1.4] text-ink">
                Estate is live
              </h2>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-body">
                Last sync{" "}
                {lastSync?.startedAt
                  ? new Date(lastSync.startedAt).toLocaleString()
                  : "—"}
                . Explore the topology canvas or open any pillar from the sidebar.
              </p>
            </div>
          )}
        </Surface>
      </Reveal>
    </div>
  );
}
