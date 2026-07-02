import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistItems,
  checklists,
  complianceFindings,
  driftFindings,
  securityPosture,
} from "@/db/schema";
import { FRAMEWORKS } from "./frameworks";
import type {
  ChecklistEntryState,
  ComplianceSummary,
  Control,
  DriftDetail,
  FrameworkBreakdown,
  SecurityDetail,
  VerifiedState,
} from "./types";

/**
 * Governance query layer. Every function reads from REAL database tables
 * (complianceFindings, driftFindings, securityPosture, checklists,
 * checklistItems) — never fixtures. The verified state of each control is
 * computed by cross-referencing the framework/checklist definitions against the
 * actual finding rows.
 */

/** Parse the `meta` jsonb from a checklist item into a typed shape. */
interface ChecklistItemMeta {
  controlType?: "drift" | "security" | "compliance";
  ruleId?: string;
  framework?: string;
  category?: string;
  description?: string;
}

function parseMeta(raw: unknown): ChecklistItemMeta {
  if (typeof raw !== "object" || raw === null) return {};
  const m = raw as Record<string, unknown>;
  const ct = m.controlType;
  return {
    controlType:
      ct === "drift" || ct === "security" || ct === "compliance" ? ct : undefined,
    ruleId: typeof m.ruleId === "string" ? m.ruleId : undefined,
    framework: typeof m.framework === "string" ? m.framework : undefined,
    category: typeof m.category === "string" ? m.category : undefined,
    description: typeof m.description === "string" ? m.description : undefined,
  };
}

/**
 * Evaluate a single control against the loaded finding rows. This is the core
 * verification primitive — every ✓/✗ across the estate traces through here.
 */
function evaluateControl(
  control: Control,
  driftRows: { classification: string }[],
  securityRows: { severity: string | null }[],
  complianceByRule: Map<string, { status: string }>,
): VerifiedState {
  if (control.ref === "drift") {
    const drifted = driftRows.filter(
      (d) => d.classification === "drifted" || d.classification === "missing_in_cloud",
    );
    const unmanaged = driftRows.filter((d) => d.classification === "unmanaged");
    if (drifted.length > 0) return "fail";
    if (unmanaged.length > 0) return "warn";
    return "pass";
  }

  if (control.ref === "security") {
    const criticalHigh = securityRows.filter(
      (s) => s.severity === "critical" || s.severity === "high",
    );
    const medium = securityRows.filter((s) => s.severity === "medium");
    if (criticalHigh.length > 0) return "fail";
    if (medium.length > 0) return "warn";
    return "pass";
  }

  if (control.ref === "compliance") {
    const finding = complianceByRule.get(control.ruleId);
    if (!finding) return "unknown";
    if (finding.status === "pass") return "pass";
    if (finding.status === "warn") return "warn";
    return "fail";
  }

  return "unknown";
}

/**
 * Compute the overall compliance summary: total controls evaluated, pass/fail/
 * warn counts, drift + security finding totals, per-framework breakdowns, and a
 * posture score (0–100) derived from real deductions.
 *
 * Each framework control is evaluated against the finding table its `ref`
 * points at — so the coverage ratios reflect the live estate, not a static
 * checklist.
 */
export async function getComplianceSummary(): Promise<ComplianceSummary> {
  const [complianceRows, driftRows, securityRows] = await Promise.all([
    db
      .select({ ruleId: complianceFindings.ruleId, status: complianceFindings.status })
      .from(complianceFindings),
    db.select({ classification: driftFindings.classification }).from(driftFindings),
    db
      .select({
        severity: securityPosture.severity,
        exposed: securityPosture.exposed,
      })
      .from(securityPosture),
  ]);

  const complianceByRule = new Map(
    complianceRows.map((r) => [r.ruleId, { status: r.status }]),
  );

  // Evaluate every framework control against real findings.
  let passed = 0;
  let failed = 0;
  let warned = 0;
  let unknown = 0;

  const frameworks: FrameworkBreakdown[] = [];
  for (const fw of Object.values(FRAMEWORKS)) {
    let fPassed = 0;
    let fFailed = 0;
    let fWarned = 0;

    for (const control of fw.controls) {
      const v = evaluateControl(control, driftRows, securityRows, complianceByRule);
      if (v === "pass") {
        fPassed++;
        passed++;
      } else if (v === "fail") {
        fFailed++;
        failed++;
      } else if (v === "warn") {
        fWarned++;
        warned++;
      } else {
        unknown++;
      }
    }

    frameworks.push({
      id: fw.id,
      name: fw.name,
      description: fw.description,
      passed: fPassed,
      failed: fFailed,
      warned: fWarned,
      total: fw.controls.length,
    });
  }

  const totalControls = passed + failed + warned + unknown;

  const securityCritical = securityRows.filter((s) => s.severity === "critical").length;
  const securityHigh = securityRows.filter((s) => s.severity === "high").length;
  const securityMedium = securityRows.filter((s) => s.severity === "medium").length;

  // Posture score: start at 100, deduct for real findings.
  const deductions =
    securityCritical * 8 +
    securityHigh * 5 +
    securityMedium * 2 +
    driftRows.length * 3 +
    failed * 4;
  const postureScore = Math.max(0, Math.min(100, 100 - deductions));

  return {
    totalControls,
    passed,
    failed,
    warned,
    driftCount: driftRows.length,
    securityCount: securityRows.length,
    securityCritical,
    securityHigh,
    postureScore,
    frameworks,
  };
}

/**
 * Resolve every checklist item's verified state by cross-referencing its `meta`
 * control reference against the real finding tables.
 *
 * - `meta.controlType: "drift"` → pass if no drifted/missing findings; fail if
 *   any drifted/missing; warn if only unmanaged.
 * - `meta.controlType: "security"` → pass if no critical/high; warn if medium;
 *   fail if critical or high.
 * - `meta.controlType: "compliance"` → resolved from the matching
 *   complianceFinding row by ruleId.
 * - No controlType → `unknown` (manual / not yet wired).
 */
export async function getChecklistState(): Promise<ChecklistEntryState[]> {
  const [items, driftRows, securityRows, complianceRows] = await Promise.all([
    db.select().from(checklistItems).orderBy(asc(checklistItems.position)),
    db.select({ classification: driftFindings.classification }).from(driftFindings),
    db.select({ severity: securityPosture.severity }).from(securityPosture),
    db
      .select({ ruleId: complianceFindings.ruleId, status: complianceFindings.status })
      .from(complianceFindings),
  ]);

  const complianceByRule = new Map(complianceRows.map((r) => [r.ruleId, r]));

  const driftedCount = driftRows.filter(
    (d) => d.classification === "drifted" || d.classification === "missing_in_cloud",
  ).length;
  const unmanagedCount = driftRows.filter((d) => d.classification === "unmanaged").length;

  const criticalHighCount = securityRows.filter(
    (s) => s.severity === "critical" || s.severity === "high",
  ).length;
  const mediumCount = securityRows.filter((s) => s.severity === "medium").length;

  return items.map((item) => {
    const meta = parseMeta(item.meta);
    const category = meta.category ?? "Infrastructure";
    let verified: VerifiedState = "unknown";
    let count: number | undefined;

    if (meta.controlType === "drift") {
      if (driftedCount > 0) {
        verified = "fail";
        count = driftedCount;
      } else if (unmanagedCount > 0) {
        verified = "warn";
        count = unmanagedCount;
      } else {
        verified = "pass";
      }
    } else if (meta.controlType === "security") {
      if (criticalHighCount > 0) {
        verified = "fail";
        count = criticalHighCount;
      } else if (mediumCount > 0) {
        verified = "warn";
        count = mediumCount;
      } else {
        verified = "pass";
      }
    } else if (meta.controlType === "compliance" && meta.ruleId) {
      const finding = complianceByRule.get(meta.ruleId);
      if (!finding) {
        verified = "unknown";
      } else if (finding.status === "pass") {
        verified = "pass";
      } else if (finding.status === "warn") {
        verified = "warn";
      } else {
        verified = "fail";
      }
    }

    return {
      id: item.id,
      label: item.label,
      description: meta.description ?? undefined,
      verified,
      severity: item.severity ?? undefined,
      count,
      category,
      done: item.done,
      checklistId: item.checklistId,
      framework: meta.framework,
    };
  });
}

/** Recent drift findings (urn + classification) for guided-flow display. */
export async function getDriftDetail(limit = 24): Promise<DriftDetail[]> {
  const rows = await db
    .select({
      urn: driftFindings.urn,
      env: driftFindings.env,
      module: driftFindings.module,
      classification: driftFindings.classification,
      detectedAt: driftFindings.detectedAt,
    })
    .from(driftFindings)
    .orderBy(desc(driftFindings.detectedAt))
    .limit(limit);
  return rows.map((r) => ({
    urn: r.urn,
    env: r.env,
    module: r.module,
    classification: r.classification,
  }));
}

/** Recent security posture findings for guided-flow display, worst first. */
export async function getSecurityDetail(limit = 24): Promise<SecurityDetail[]> {
  const rows = await db
    .select({
      urn: securityPosture.urn,
      title: securityPosture.title,
      category: securityPosture.category,
      severity: securityPosture.severity,
      exposed: securityPosture.exposed,
      provider: securityPosture.provider,
    })
    .from(securityPosture)
    .orderBy(
      sql`case ${securityPosture.severity}
            when 'critical' then 0
            when 'high' then 1
            when 'medium' then 2
            when 'low' then 3
            else 4 end`,
    )
    .limit(limit);
  return rows.map((r) => ({
    urn: r.urn,
    title: r.title,
    category: r.category,
    severity: r.severity,
    exposed: r.exposed,
    provider: r.provider,
  }));
}

/** Toggle a checklist item's `done` flag (the one manual write path). */
export async function setChecklistItemDone(
  id: string,
  done: boolean,
): Promise<void> {
  await db
    .update(checklistItems)
    .set({ done })
    .where(eq(checklistItems.id, id));
}

/** Count checklists (used by the API to decide empty-state). */
export async function getChecklistCount(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(checklists);
  return row?.n ?? 0;
}
