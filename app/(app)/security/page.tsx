import type { Metadata } from "next";
import { sql } from "drizzle-orm";
import { AlertOctagon, Clock3, ScanSearch, ShieldAlert } from "lucide-react";

import { db } from "@/db";
import { securityPosture, vulnerabilityFindings } from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { ProviderChip } from "@/components/ui/ProviderChip";
import { VulnCounter } from "@/components/widgets/VulnCounter";
import { SecurityFindingsView } from "./findings-view";
import { SEVERITIES, type CloudProvider, type Severity } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Security & Vulnerabilities" };
export const dynamic = "force-dynamic";

/** Coerce a raw SQL aggregate (Date from node-postgres, string elsewhere) to Date. */
function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeAgo(d: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default async function SecurityPage() {
  const [[vulnAgg], sevRows, provRows, [postureAgg]] = await Promise.all([
    db
      .select({
        open: sql<number>`count(*) filter (where ${vulnerabilityFindings.status} = 'open')::int`,
        critical: sql<number>`count(*) filter (where ${vulnerabilityFindings.status} = 'open' and ${vulnerabilityFindings.severity} = 'critical')::int`,
        sources: sql<number>`count(distinct ${vulnerabilityFindings.source})::int`,
        lastSeen: sql<Date | string | null>`max(${vulnerabilityFindings.lastSeen})`,
      })
      .from(vulnerabilityFindings),
    db
      .select({ severity: securityPosture.severity, n: sql<number>`count(*)::int` })
      .from(securityPosture)
      .groupBy(securityPosture.severity),
    db
      .select({ provider: securityPosture.provider, n: sql<number>`count(*)::int` })
      .from(securityPosture)
      .groupBy(securityPosture.provider),
    db
      .select({
        total: sql<number>`count(*)::int`,
        lastCaptured: sql<Date | string | null>`max(${securityPosture.capturedAt})`,
      })
      .from(securityPosture),
  ]);

  const bySeverity = new Map<Severity, number>();
  for (const r of sevRows) if (r.severity) bySeverity.set(r.severity as Severity, r.n);
  const byProvider = new Map<CloudProvider, number>();
  for (const r of provRows) {
    if (r.provider) byProvider.set(r.provider as CloudProvider, r.n);
  }
  const postureTotal = postureAgg?.total ?? 0;

  // "Last scan" is the newest write across both scan-fed tables — the posture
  // snapshot (what GET /api/security reports) and the durable findings feed.
  const scanDates = [toDate(vulnAgg?.lastSeen), toDate(postureAgg?.lastCaptured)].filter(
    (d): d is Date => d !== null,
  );
  const lastScan =
    scanDates.length > 0 ? new Date(Math.max(...scanDates.map((d) => d.getTime()))) : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <PageHeader
          title="Security & Vulnerabilities"
          iconTone="iris"
          icon={<ShieldAlert size={22} strokeWidth={1.75} className="text-iris" />}
          description="Truesight watches your estate read-only — Inspector2, Security Hub, ECR, Defender for Cloud, Dependabot and CodeQL."
        />
      </Reveal>

      {/* Scanner console header — live counts from the durable findings feed */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Reveal>
          <StatTile
            label="Open findings"
            value={vulnAgg?.open ?? 0}
            icon={<ShieldAlert strokeWidth={1.75} />}
            className="h-full"
          />
        </Reveal>
        <Reveal delay={0.04}>
          <StatTile
            label="Critical open"
            value={vulnAgg?.critical ?? 0}
            icon={<AlertOctagon strokeWidth={1.75} />}
            className="h-full"
          />
        </Reveal>
        <Reveal delay={0.08}>
          <StatTile
            label="Sources scanned"
            value={vulnAgg?.sources ?? 0}
            icon={<ScanSearch strokeWidth={1.75} />}
            className="h-full"
          />
        </Reveal>
        <Reveal delay={0.12}>
          {/* Time reads as prose, not a RollupNumber — a local tile in StatTile's clothes. */}
          <div className="h-full rounded-lg border border-hairline bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label font-medium leading-[1.5] tracking-[0.015em] text-mute">
                Last scan
              </span>
              <span className="text-ash [&>svg]:size-4" aria-hidden>
                <Clock3 strokeWidth={1.75} />
              </span>
            </div>
            <div className="mt-2 font-mono text-[22px] font-medium leading-[1.2] text-ink">
              {lastScan ? timeAgo(lastScan) : "—"}
            </div>
            {lastScan ? (
              <div className="mt-1 text-[12px] leading-[1.5] text-mute">
                {lastScan.toLocaleString()}
              </div>
            ) : (
              <div className="mt-1 text-[12px] leading-[1.5] text-mute">No scans recorded</div>
            )}
          </div>
        </Reveal>
      </div>

      {/* Posture snapshot — severity + provider breakdown from security_posture */}
      {postureTotal > 0 ? (
        <>
          <Reveal delay={0.12}>
            <div className="mt-8 mb-3 flex items-center gap-2">
              <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Posture snapshot
              </h2>
              <span className="font-mono text-[12px] text-mute tabular-nums">
                {postureTotal}
              </span>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {SEVERITIES.map((sev, i) => (
              <Reveal key={sev} delay={0.12 + i * 0.04}>
                <VulnCounter severity={sev} count={bySeverity.get(sev) ?? 0} />
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.16}>
            <Surface level={1} radius="lg" className="mt-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                  By provider
                </h3>
                <span className="font-mono text-[12px] text-mute tabular-nums">
                  {postureTotal} findings
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {[...byProvider.entries()].map(([provider, count]) => (
                  <span
                    key={provider}
                    className="inline-flex items-center gap-2 rounded-full bg-surface-elevated px-2.5 py-1"
                  >
                    <ProviderChip provider={provider} />
                    <span className="font-mono text-[12px] text-ink tabular-nums">{count}</span>
                  </span>
                ))}
              </div>
            </Surface>
          </Reveal>
        </>
      ) : null}

      {/* Findings explorer — the interactive scanner console (client island) */}
      <Reveal delay={0.16}>
        <div className="mt-8 mb-3 flex items-center gap-2">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Findings
          </h2>
        </div>
      </Reveal>
      <Reveal delay={0.2}>
        <SecurityFindingsView />
      </Reveal>
    </div>
  );
}
