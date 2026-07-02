import type { Severity } from "@/lib/taxonomy";
import type { CloudProvider } from "@/lib/taxonomy";
import type { SecurityFinding, VulnScanResult } from "@/lib/integrations/security";
import { makeUrn } from "@/lib/integrations/types";
import { createGithubClient } from "./client";

/**
 * GitHub codebase vulnerability adapter — read-only capture across two streams:
 *
 *   Dependabot   — vulnerable dependency alerts (`dependabot.listAlertsForOrg`)
 *   CodeQL       — code-scanning alerts (`codeScanning.listAlertsForOrg`)
 *
 * Both are paginated org-wide over every repository. Each alert maps onto a
 * canonical {@link SecurityFinding} with the vulnerable dependency name +
 * advisory URL in `details.resourceLink` and the advisory summary in
 * `details.remediation`. A failure in one stream never aborts the other.
 */

export interface ScanGithubVulnsOpts {
  org?: string;
  token?: string;
  /** Concurrency cap for per-repo fan-out. */
  concurrency?: number;
}

export async function scanGithubVulns(opts: ScanGithubVulnsOpts = {}): Promise<VulnScanResult> {
  const client = createGithubClient({ org: opts.org, token: opts.token });
  const org = client.org;
  const errors: VulnScanResult["errors"] = [];
  const findings: SecurityFinding[] = [];

  // 1. Dependabot alerts — org-wide.
  try {
    const alerts = (await client.paginate(client.rest.dependabot.listAlertsForOrg, {
      org,
      state: "open",
      per_page: 100,
    })) as unknown as DependabotAlertRow[];
    for (const a of alerts) {
      const f = mapDependabot(a, org);
      if (f) findings.push(f);
    }
  } catch (err) {
    errors.push({ scope: `github:dependabot:${org}`, message: errMsg(err) });
  }

  // 2. CodeQL alerts — org-wide.
  try {
    const alerts = (await client.paginate(client.rest.codeScanning.listAlertsForOrg, {
      org,
      state: "open",
      per_page: 100,
    })) as unknown as CodeScanningAlertRow[];
    for (const a of alerts) {
      const f = mapCodeScanning(a, org);
      if (f) findings.push(f);
    }
  } catch (err) {
    errors.push({ scope: `github:codeql:${org}`, message: errMsg(err) });
  }

  return { findings, partial: errors.length > 0, errors };
}

/* -------------------------------------------------------------------------- */
/* Dependabot                                                                 */
/* -------------------------------------------------------------------------- */

interface DependabotAlertRow {
  number?: number;
  state?: string;
  severity?: string;
  security_advisory?: {
    ghsa_id?: string;
    cve_id?: string | null;
    summary?: string;
    description?: string;
    severity?: string;
    cvss?: { score?: number };
    url?: string;
    references?: string[];
  };
  dependency?: { package?: { name?: string; ecosystem?: string } };
  repository?: { full_name?: string; html_url?: string };
  html_url?: string;
}

function mapDependabot(a: DependabotAlertRow, org: string): SecurityFinding | null {
  const num = a.number;
  const repo = a.repository?.full_name;
  const pkg = a.dependency?.package?.name ?? "dependency";
  if (!num || !repo) return null;

  const advisory = a.security_advisory ?? {};
  const severity = mapGithubSeverity(a.severity ?? advisory.severity);
  const advisoryUrl =
    advisory.url ?? advisory.ghsa_id
      ? `https://github.com/advisories/${advisory.ghsa_id}`
      : undefined;

  return {
    urn: urnFor("github", org, `dependabot/${repo}/${num}`),
    provider: "github",
    category: "dependency",
    title: `${pkg} — ${advisory.summary ?? "vulnerable dependency"} (${repo})`,
    severity,
    exposed: false,
    score: typeof advisory.cvss?.score === "number" ? Math.round(advisory.cvss.score * 10) : null,
    details: {
      resourceLink: a.html_url ?? advisoryUrl ?? a.repository?.html_url,
      remediation:
        advisory.summary
          ? `Upgrade ${pkg} to a patched release. ${advisory.summary}`
          : `Upgrade ${pkg} to a patched release to resolve this advisory.`,
      description: advisory.description ?? undefined,
      package: pkg,
      ecosystem: a.dependency?.package?.ecosystem ?? undefined,
      ghsaId: advisory.ghsa_id ?? undefined,
      cveId: advisory.cve_id ?? undefined,
      advisoryUrl,
      repository: repo,
      source: "dependabot",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* CodeQL / code scanning                                                     */
/* -------------------------------------------------------------------------- */

interface CodeScanningAlertRow {
  number?: number;
  state?: string;
  rule?: {
    id?: string;
    name?: string;
    description?: string;
    security_severity_level?: string;
    severity?: string;
    full_description?: { text?: string };
  };
  most_recent_instance?: {
    location?: { path?: string; start_line?: number };
    html_url?: string;
  };
  html_url?: string;
  repository?: { full_name?: string; html_url?: string };
}

function mapCodeScanning(a: CodeScanningAlertRow, org: string): SecurityFinding | null {
  const num = a.number;
  const repo = a.repository?.full_name;
  const rule = a.rule;
  if (!num || !repo || !rule) return null;

  const severity = mapGithubSeverity(rule.security_severity_level ?? rule.severity);
  const inst = a.most_recent_instance ?? {};
  const path = inst.location?.path
    ? `${inst.location.path}${inst.location.start_line ? `:${inst.location.start_line}` : ""}`
    : undefined;

  return {
    urn: urnFor("github", org, `codeql/${repo}/${num}`),
    provider: "github",
    category: "code-scanning",
    title: `${rule.name ?? rule.id ?? "CodeQL alert"} (${repo})`,
    severity,
    exposed: false,
    score: null,
    details: {
      resourceLink: a.html_url ?? inst.html_url ?? a.repository?.html_url,
      remediation:
        rule.full_description?.text ??
        rule.description ??
        "Review the alert and apply the suggested code fix or suppress if a false positive.",
      description: rule.description ?? undefined,
      ruleId: rule.id ?? undefined,
      path,
      repository: repo,
      source: "codeql",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function mapGithubSeverity(raw?: string | null): Severity {
  switch ((raw ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
    case "moderate":
      return "medium";
    case "low":
      return "low";
    case "informational":
    case "info":
    case "warning":
      return "info";
    case "error":
      return "high";
    default:
      return "medium";
  }
}

function urnFor(provider: CloudProvider, account: string, id: string): string {
  return makeUrn({ provider, account, region: null, service: "security", nativeId: id });
}

function errMsg(err: unknown): string {
  const e = err as { message?: string; name?: string; status?: number };
  return e?.message ?? e?.name ?? String(err);
}
