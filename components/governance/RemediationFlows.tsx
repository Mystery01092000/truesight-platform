"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { GuidedFlow, type GuidedStep, type StepStatus } from "@/components/ui/GuidedFlow";
import { GUIDED_FLOWS } from "@/lib/governance/flows";
import type { DriftDetail, SecurityDetail } from "@/lib/governance/types";

/**
 * RemediationFlows — renders the two live remediation workflows ("Remediate
 * drift" and "Resolve security findings") inside GuidedFlow shells. Each flow's
 * step content is driven by REAL finding data passed from the server component.
 *
 * When there are no findings the entire flow resolves to "done" and shows a
 * clean-state message. When findings exist the user steps through detect →
 * review → remediate → verify, with the drifted resources / exposures listed
 * inline and linked to the topology canvas.
 */

const CLASSIFICATION_LABEL: Record<string, string> = {
  drifted: "Drifted",
  missing_in_cloud: "Missing in cloud",
  unmanaged: "Unmanaged",
};

/** Build GuidedStep[] from a flow def, marking all done if the estate is clean. */
function buildSteps(
  stepDefs: { id: string; label: string }[],
  clean: boolean,
  activeIndex: number,
): GuidedStep[] {
  return stepDefs.map((s, i) => {
    let status: StepStatus;
    if (clean) status = "done";
    else if (i < activeIndex) status = "done";
    else if (i === activeIndex) status = "active";
    else status = "pending";
    return { id: s.id, label: s.label, status };
  });
}

function CleanState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <CheckCircle2 size={16} className="shrink-0 text-accent-green" />
      <span className="text-[13px] leading-[1.5] text-body">{text}</span>
    </div>
  );
}

function StepBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 py-0.5">{children}</div>;
}

function FindingRow({
  urn,
  label,
  badge,
  href,
}: {
  urn: string;
  label: string;
  badge?: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="truncate font-mono text-[12px] text-body">{urn}</span>
      {badge ? (
        <span className="shrink-0 rounded-xs bg-surface-elevated px-1.5 py-0.5 text-[11px] text-mute">
          {badge}
        </span>
      ) : null}
      <span className="shrink-0 text-[11px] text-mute">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-1.5 transition-colors hover:bg-surface-elevated"
      >
        {content}
        <ArrowUpRight size={13} className="ml-auto shrink-0 text-mute" />
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-1.5">
      {content}
    </div>
  );
}

export function RemediationFlows({
  driftFindings,
  securityFindings,
}: {
  driftFindings: DriftDetail[];
  securityFindings: SecurityDetail[];
}) {
  const [driftIdx, setDriftIdx] = useState(0);
  const [secIdx, setSecIdx] = useState(0);

  const driftDef = GUIDED_FLOWS.find((f) => f.id === "remediate-drift")!;
  const secDef = GUIDED_FLOWS.find((f) => f.id === "resolve-security")!;

  const driftClean = driftFindings.length === 0;
  const secClean = securityFindings.length === 0;

  const driftSteps = buildSteps(driftDef.steps, driftClean, driftIdx);
  const secSteps = buildSteps(secDef.steps, secClean, secIdx);

  // Clamp indices if clean state shifted.
  const dIdx = driftClean ? 0 : Math.min(driftIdx, driftDef.steps.length - 1);
  const sIdx = secClean ? 0 : Math.min(secIdx, secDef.steps.length - 1);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Remediate drift ─────────────────────────────────────────────── */}
      <GuidedFlow
        steps={driftSteps}
        activeIndex={dIdx}
        readOnly={driftClean}
        onNext={() => setDriftIdx((i) => Math.min(i + 1, driftDef.steps.length - 1))}
        onBack={() => setDriftIdx((i) => Math.max(i - 1, 0))}
      >
        <h3 className="mb-1 text-[14px] font-medium text-ink">{driftDef.title}</h3>
        <p className="mb-3 text-[12.5px] leading-[1.5] text-mute">
          {driftDef.steps[dIdx]?.description}
        </p>

        {driftClean ? (
          <CleanState text="No drift detected — all resources match their Terraform state." />
        ) : dIdx === 0 ? (
          <StepBody>
            <p className="text-[13px] leading-[1.5] text-body">
              <span className="font-mono tabular-nums text-ink">{driftFindings.length}</span>{" "}
              resource{driftFindings.length === 1 ? "" : "s"} ha
              {driftFindings.length === 1 ? "s" : "ve"} drifted from declared state.
            </p>
            <div className="flex flex-col gap-1">
              {driftFindings.slice(0, 4).map((f, i) => (
                <FindingRow
                  key={`${f.urn}-${i}`}
                  urn={f.urn}
                  label={CLASSIFICATION_LABEL[f.classification] ?? f.classification}
                  badge={f.env ?? undefined}
                />
              ))}
            </div>
          </StepBody>
        ) : dIdx === 1 ? (
          <StepBody>
            <p className="text-[12.5px] leading-[1.5] text-mute">
              Open each resource on the topology canvas to inspect the weave and its dependencies.
            </p>
            <div className="flex flex-col gap-1">
              {driftFindings.slice(0, 5).map((f, i) => (
                <FindingRow
                  key={`${f.urn}-${i}`}
                  urn={f.urn}
                  label={CLASSIFICATION_LABEL[f.classification] ?? f.classification}
                  href={`/topology`}
                />
              ))}
            </div>
          </StepBody>
        ) : dIdx === 2 ? (
          <StepBody>
            <ul className="ml-1 list-disc space-y-1.5 pl-3.5 text-[13px] leading-[1.55] text-body">
              <li>
                If the cloud drifted from the source, re-apply{" "}
                <span className="font-mono text-[12px] text-ink">terraform apply</span>.
              </li>
              <li>
                If the source is wrong, update the declaration and merge to main.
              </li>
              <li>Tag unmanaged resources or import them into Terraform state.</li>
            </ul>
          </StepBody>
        ) : (
          <StepBody>
            <p className="text-[13px] leading-[1.5] text-body">
              Trigger a sync from the estate page. Argus will re-evaluate drift and
              update this flow automatically.
            </p>
          </StepBody>
        )}
      </GuidedFlow>

      {/* ── Resolve security findings ──────────────────────────────────── */}
      <GuidedFlow
        steps={secSteps}
        activeIndex={sIdx}
        readOnly={secClean}
        onNext={() => setSecIdx((i) => Math.min(i + 1, secDef.steps.length - 1))}
        onBack={() => setSecIdx((i) => Math.max(i - 1, 0))}
      >
        <h3 className="mb-1 text-[14px] font-medium text-ink">{secDef.title}</h3>
        <p className="mb-3 text-[12.5px] leading-[1.5] text-mute">
          {secDef.steps[sIdx]?.description}
        </p>

        {secClean ? (
          <CleanState text="No critical or high-severity exposures detected across the estate." />
        ) : sIdx === 0 ? (
          <StepBody>
            <p className="text-[13px] leading-[1.5] text-body">
              <span className="font-mono tabular-nums text-ink">{securityFindings.length}</span>{" "}
              finding{securityFindings.length === 1 ? "" : "s"} need attention.
            </p>
            <div className="flex flex-col gap-1">
              {securityFindings.slice(0, 4).map((f, i) => (
                <FindingRow
                  key={`${f.urn ?? "n/a"}-${i}`}
                  urn={f.urn ?? f.title ?? "Unknown"}
                  label={(f.severity ?? "—").toUpperCase()}
                  badge={f.exposed ? "EXPOSED" : undefined}
                />
              ))}
            </div>
          </StepBody>
        ) : sIdx === 1 ? (
          <StepBody>
            <p className="text-[12.5px] leading-[1.5] text-mute">
              Review each exposure and its resource on the topology canvas.
            </p>
            <div className="flex flex-col gap-1">
              {securityFindings.slice(0, 5).map((f, i) => (
                <FindingRow
                  key={`${f.urn ?? "n/a"}-${i}`}
                  urn={f.urn ?? f.title ?? "Unknown"}
                  label={(f.severity ?? "—").toUpperCase()}
                  href={`/topology`}
                />
              ))}
            </div>
          </StepBody>
        ) : sIdx === 2 ? (
          <StepBody>
            <ul className="ml-1 list-disc space-y-1.5 pl-3.5 text-[13px] leading-[1.55] text-body">
              <li>Apply the remediation for the finding category (policy, config, or rotation).</li>
              <li>Tighten the security group / network rule if the resource is exposed.</li>
              <li>Quarantine the resource if remediation cannot be applied immediately.</li>
            </ul>
          </StepBody>
        ) : (
          <StepBody>
            <p className="text-[13px] leading-[1.5] text-body">
              The next sync re-scans posture and updates the score. Closed findings
              drop off automatically.
            </p>
          </StepBody>
        )}
      </GuidedFlow>
    </div>
  );
}
