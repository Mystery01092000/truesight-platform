import type { CloudProvider, Severity } from "@/lib/taxonomy";

/**
 * The canonical security finding shape that every vulnerability adapter (AWS,
 * Azure, GitHub) normalizes into. It maps 1:1 onto a `security_posture` row:
 * the flexible `details` jsonb carries the human-facing resource link,
 * remediation guidance, and a long-form description.
 *
 * READ-ONLY by construction: adapters only ever *read* findings from upstream
 * security services; nothing here mutates a cloud or repository state.
 */
export interface SecurityFinding {
  /**
   * Stable, deterministic identifier for the finding. Built from the native
   * finding id / ARN so the same upstream finding upserts the same row across
   * scans (instead of duplicating on every run).
   */
  urn: string;
  provider: CloudProvider;
  /** Coarse grouping surfaced as a filter — e.g. "vulnerability", "config", "container". */
  category: string;
  title: string;
  severity: Severity;
  /** True when the vulnerable resource is publicly reachable / internet-exposed. */
  exposed: boolean;
  /** Optional numeric risk score (0–100) from the upstream service, if reported. */
  score?: number | null;
  details: {
    /** Clickable deep link to the finding/resource in the provider console. */
    resourceLink?: string;
    /** Proposed mitigation plan — the actionable "what to do". */
    remediation?: string;
    /** Long-form description of the vulnerability/finding. */
    description?: string;
    [key: string]: unknown;
  };
}

/** Minimal adapter result — what each `scan*Vulns` returns. */
export interface VulnScanResult {
  findings: SecurityFinding[];
  /** True when some scope failed but we still returned what succeeded. */
  partial: boolean;
  /** Human-readable scope label for the failure, surfaced to operators. */
  errors: { scope: string; message: string }[];
}

/** Map an AWS-style severity token onto the canonical {@link Severity}. */
export function mapAwsSeverity(raw?: string | null): Severity {
  switch ((raw ?? "").toUpperCase()) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    case "LOW":
      return "low";
    case "INFORMATIONAL":
    case "INFO":
      return "info";
    default:
      // Untriaged / unknown severities default to medium so they stay visible.
      return "medium";
  }
}
