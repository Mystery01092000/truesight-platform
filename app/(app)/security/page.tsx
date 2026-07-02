import type { Metadata } from "next";
import { desc, sql } from "drizzle-orm";
import { ShieldAlert } from "lucide-react";

import { db } from "@/db";
import { securityPosture } from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderChip } from "@/components/ui/ProviderChip";
import { VulnCounter } from "@/components/widgets/VulnCounter";
import { SecurityFindingsView } from "./findings-view";
import { SEVERITIES, type CloudProvider, type Severity } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Security & Vulnerabilities" };
export const dynamic = "force-dynamic";

/** Order severities critical→info for the counter row + DB ordering. */
function severityWeight() {
  return sql<number>`case ${securityPosture.severity}
    when 'critical' then 5
    when 'high' then 4
    when 'medium' then 3
    when 'low' then 2
    when 'info' then 1
    else 0
  end`;
}

export interface FindingView {
  id: string;
  urn: string | null;
  provider: CloudProvider | null;
  category: string | null;
  title: string | null;
  severity: Severity | null;
  exposed: boolean;
  score: number | null;
  details: {
    resourceLink?: string | null;
    remediation?: string | null;
    description?: string | null;
  } | null;
  capturedAt: Date;
}

export default async function SecurityPage() {
  const rows = await db
    .select()
    .from(securityPosture)
    .orderBy(desc(severityWeight()), desc(securityPosture.capturedAt));

  const findings: FindingView[] = rows.map((r) => ({
    id: r.id,
    urn: r.urn,
    provider: (r.provider ?? null) as CloudProvider | null,
    category: r.category,
    title: r.title,
    severity: (r.severity ?? null) as Severity | null,
    exposed: r.exposed,
    score: r.score,
    details: (r.details ?? null) as FindingView["details"],
    capturedAt: r.capturedAt,
  }));

  const bySeverity = new Map<Severity, number>();
  const byProvider = new Map<CloudProvider, number>();
  for (const f of findings) {
    if (f.severity) bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    if (f.provider) byProvider.set(f.provider, (byProvider.get(f.provider) ?? 0) + 1);
  }

  const total = findings.length;
  const lastScan = findings[0]?.capturedAt ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
            aria-hidden
          >
            <ShieldAlert size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Security &amp; Vulnerabilities
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Argus watches your estate read-only — Inspector2, Security Hub, ECR, Defender for
              Cloud, Dependabot and CodeQL.
              {lastScan ? (
                <>
                  <span className="mx-1.5" aria-hidden>·</span>
                  Last scan {lastScan.toLocaleString()}
                </>
              ) : null}
            </p>
          </div>
        </header>
      </Reveal>

      {/* Severity counter row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {SEVERITIES.map((sev, i) => (
          <Reveal key={sev} delay={i * 0.05}>
            <VulnCounter severity={sev} count={bySeverity.get(sev) ?? 0} />
          </Reveal>
        ))}
      </div>

      {/* Provider breakdown */}
      <Reveal delay={0.1}>
        <Surface level={1} radius="lg" className="mt-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              By provider
            </h2>
            <span className="font-mono text-[12px] text-mute tabular-nums">{total} findings</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {byProvider.size === 0 ? (
              <span className="text-[13px] text-mute">No findings yet.</span>
            ) : (
              [...byProvider.entries()].map(([provider, count]) => (
                <span
                  key={provider}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-2.5 py-1"
                >
                  <ProviderChip provider={provider} />
                  <span className="font-mono text-[12px] text-ink tabular-nums">{count}</span>
                </span>
              ))
            )}
          </div>
        </Surface>
      </Reveal>

      {/* Findings list — filterable (client) */}
      <Reveal delay={0.15}>
        <div className="mt-8 mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Findings
          </h2>
          <span className="font-mono text-[12px] text-mute tabular-nums">{total}</span>
        </div>
      </Reveal>

      {total === 0 ? (
        <Reveal delay={0.2}>
          <EmptyState
            icon={<ShieldAlert size={24} strokeWidth={1.5} />}
            title={lastScan ? "Argus hasn't found any vulnerabilities" : "No security data yet"}
            description={
              lastScan
                ? "The last scan came back clean. New findings will surface here as soon as they appear."
                : "Run a scan to capture vulnerabilities and security findings across AWS, Azure and GitHub."
            }
          />
        </Reveal>
      ) : (
        <SecurityFindingsView findings={findings} />
      )}
    </div>
  );
}
