import type { Severity } from "@/lib/taxonomy";

/**
 * Governance domain types — shared across the query layer, framework/control
 * definitions, guided-flow definitions, API contracts and UI components.
 *
 * Kept free of `server-only`, database, and React imports so it resolves in any
 * module graph (server queries, client components, route handlers).
 */

/** The four-state verification result resolved from REAL findings. */
export type VerifiedState = "pass" | "fail" | "warn" | "unknown";

/** Coarse checklist grouping axis rendered in the UI. */
export type ControlCategory = "Infrastructure" | "Security" | "Cost" | "Operations";

/** Which finding table a control is verified against. */
export type ControlRef = "drift" | "security" | "compliance";

/** A single compliance control within a framework. */
export interface Control {
  ruleId: string;
  title: string;
  description?: string;
  severity?: Severity;
  category: ControlCategory;
  /** Which finding table backs this control's verified state. */
  ref?: ControlRef;
}

/** A standard compliance framework (CIS, SOC2, custom, ...). */
export interface Framework {
  id: string;
  name: string;
  description: string;
  controls: Control[];
}

/** Template step inside a guided compliance workflow. */
export interface GuidedFlowStepDef {
  id: string;
  label: string;
  description?: string;
}

/** A guided remediation / onboarding workflow definition. */
export interface GuidedFlowDef {
  id: string;
  title: string;
  description?: string;
  steps: GuidedFlowStepDef[];
}

/** Per-framework pass/fail/warn rollup computed from real findings. */
export interface FrameworkBreakdown {
  id: string;
  name: string;
  description: string;
  passed: number;
  failed: number;
  warned: number;
  total: number;
}

/** Top-level compliance posture summary. */
export interface ComplianceSummary {
  totalControls: number;
  passed: number;
  failed: number;
  warned: number;
  driftCount: number;
  securityCount: number;
  securityCritical: number;
  securityHigh: number;
  /** Overall posture score 0–100, derived from real deductions. */
  postureScore: number;
  frameworks: FrameworkBreakdown[];
}

/** A checklist item whose verified state has been resolved from real findings. */
export interface ChecklistEntryState {
  id: string;
  label: string;
  description?: string;
  verified: VerifiedState;
  severity?: Severity;
  /** Count of underlying findings backing this verdict. */
  count?: number;
  category: string;
  done: boolean;
  checklistId: string;
  /** Optional framework this control belongs to (drives filtering). */
  framework?: string;
}

/** Lightweight drift finding row for guided-flow display. */
export interface DriftDetail {
  urn: string;
  env: string | null;
  module: string | null;
  classification: string;
}

/** Lightweight security finding row for guided-flow display. */
export interface SecurityDetail {
  urn: string | null;
  title: string | null;
  category: string | null;
  severity: string | null;
  exposed: boolean;
  provider: string | null;
}
