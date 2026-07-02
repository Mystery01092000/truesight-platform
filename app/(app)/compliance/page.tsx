import type { Metadata } from "next";
import { ScrollText, GitBranch, ShieldAlert, CheckCircle2 } from "lucide-react";

import {
  getChecklistState,
  getComplianceSummary,
  getDriftDetail,
  getSecurityDetail,
} from "@/lib/governance/query";
import { FRAMEWORKS } from "@/lib/governance/frameworks";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { RollupNumber } from "@/components/ui/RollupNumber";
import {
  VerifiedChecklist,
  type ChecklistEntry,
} from "@/components/ui/VerifiedChecklist";
import { FrameworkCard } from "@/components/governance/FrameworkCard";
import { ComplianceScore } from "@/components/governance/ComplianceScore";
import { FrameworkTabs } from "@/components/governance/FrameworkTabs";
import { RemediationFlows } from "@/components/governance/RemediationFlows";

export const metadata: Metadata = { title: "Compliance & Governance" };
export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["Infrastructure", "Security", "Cost", "Operations"];

function sortCategories(a: string, b: string): number {
  const ia = CATEGORY_ORDER.indexOf(a);
  const ib = CATEGORY_ORDER.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b);
}

function postureLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawFw = Array.isArray(sp.framework) ? sp.framework[0] : sp.framework;
  const framework = rawFw && FRAMEWORKS[rawFw] ? rawFw : "all";

  const [summary, checklistState, driftDetail, securityDetail] = await Promise.all([
    getComplianceSummary(),
    getChecklistState(),
    getDriftDetail(),
    getSecurityDetail(),
  ]);

  const isEmpty =
    checklistState.length === 0 &&
    summary.driftCount === 0 &&
    summary.securityCount === 0;

  // Filter checklist by selected framework.
  const filteredItems =
    framework === "all"
      ? checklistState
      : checklistState.filter((c) => c.framework === framework);

  // Group by category in stable order.
  const byCategory = new Map<string, typeof checklistState>();
  for (const item of filteredItems) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }
  const categories = [...byCategory.keys()].sort(sortCategories);

  return (
    <div className="mx-auto max-w-6xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Reveal>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-iris bg-iris-soft"
            aria-hidden
          >
            <ScrollText size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Compliance &amp; Governance
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute">
              Every control is verified against the live estate — drift, security posture, and
              compliance findings. No blind spots.
            </p>
          </div>
        </header>
      </Reveal>

      {isEmpty ? (
        <Reveal delay={0.1}>
          <EmptyState
            icon={<ScrollText size={24} strokeWidth={1.5} />}
            title="Compliance posture is waiting on the first sync"
            description="Argus evaluates every control against your real cloud estate. Trigger a sync to discover resources, then drift and security findings will resolve each control's verified state automatically."
          />
        </Reveal>
      ) : (
        <>
          {/* ── Overview stat row ──────────────────────────────────────── */}
          <Reveal delay={0.05}>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Surface level={1} radius="lg" className="p-5">
                <div className="flex items-center gap-1.5 text-[13px] text-mute">
                  <CheckCircle2 size={14} />
                  Controls verified
                </div>
                <div className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                  <RollupNumber value={summary.passed} />{" "}
                  <span className="text-[18px] text-mute">
                    / {summary.totalControls}
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-mute">
                  {summary.failed} failing · {summary.warned} warnings
                </div>
              </Surface>

              <Surface level={1} radius="lg" className="p-5">
                <div className="flex items-center gap-1.5 text-[13px] text-mute">
                  <GitBranch size={14} />
                  Drift findings
                </div>
                <div className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                  <RollupNumber value={summary.driftCount} />
                </div>
                <div className="mt-2 text-[12px] text-mute">
                  state vs. live cloud
                </div>
              </Surface>

              <Surface level={1} radius="lg" className="p-5">
                <div className="flex items-center gap-1.5 text-[13px] text-mute">
                  <ShieldAlert size={14} />
                  Security findings
                </div>
                <div className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                  <RollupNumber value={summary.securityCount} />
                </div>
                <div className="mt-2 text-[12px] text-mute">
                  {summary.securityCritical} critical · {summary.securityHigh} high
                </div>
              </Surface>

              <Surface level={1} radius="lg" className="p-5">
                <div className="text-[13px] text-mute">Posture score</div>
                <div className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                  <RollupNumber value={summary.postureScore} suffix="%" />
                </div>
                <div className="mt-2 text-[12px] text-mute">
                  {postureLabel(summary.postureScore)}
                </div>
              </Surface>
            </div>
          </Reveal>

          {/* ── Framework coverage + posture gauge ─────────────────────── */}
          <Reveal delay={0.1}>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="mb-3 text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                  Framework coverage
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {summary.frameworks.map((fw) => (
                    <FrameworkCard
                      key={fw.id}
                      name={fw.name}
                      description={fw.description}
                      passed={fw.passed}
                      total={fw.total}
                    />
                  ))}
                </div>
              </div>
              <Surface
                level={1}
                radius="lg"
                className="flex flex-col items-center justify-center gap-3 p-6"
              >
                <ComplianceScore score={summary.postureScore} />
                <div className="text-center">
                  <div className="text-[12px] text-mute">Overall posture</div>
                  <div className="text-[13px] font-medium text-body">
                    {postureLabel(summary.postureScore)}
                  </div>
                </div>
              </Surface>
            </div>
          </Reveal>

          {/* ── Verified checklist ─────────────────────────────────────── */}
          <Reveal delay={0.15}>
            <div className="mt-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                  Verified checklist
                </h2>
                <FrameworkTabs active={framework} />
              </div>

              {categories.length === 0 ? (
                <Surface level={1} radius="lg" className="px-6 py-10 text-center">
                  <p className="text-[14px] text-mute">
                    {framework === "all"
                      ? "No checklist items have been defined yet."
                      : `No checklist items mapped to ${FRAMEWORKS[framework]?.name ?? framework}.`}
                  </p>
                </Surface>
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {categories.map((category) => {
                    const items = byCategory.get(category)!;
                    const entries: ChecklistEntry[] = items.map((e) => ({
                      id: e.id,
                      label: e.label,
                      description: e.description,
                      verified: e.verified,
                      severity: e.severity,
                      count: e.count,
                    }));
                    return (
                      <VerifiedChecklist
                        key={category}
                        title={category}
                        entries={entries}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </Reveal>

          {/* ── Guided remediation flows ───────────────────────────────── */}
          <Reveal delay={0.2}>
            <div className="mt-8">
              <h2 className="mb-4 text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
                Guided remediation
              </h2>
              <RemediationFlows
                driftFindings={driftDetail}
                securityFindings={securityDetail}
              />
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}
