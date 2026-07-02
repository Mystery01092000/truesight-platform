import pLimit from "p-limit";

import {
  Inspector2Client,
  paginateListFindings,
} from "@aws-sdk/client-inspector2";
import {
  SecurityHubClient,
  paginateGetFindings,
} from "@aws-sdk/client-securityhub";
import {
  ECRClient,
  paginateDescribeRepositories,
  DescribeImagesCommand,
  DescribeImageScanFindingsCommand,
} from "@aws-sdk/client-ecr";

import type { CloudResource } from "@/lib/integrations/types";
import { makeUrn } from "@/lib/integrations/types";
import {
  mapAwsSeverity,
  type SecurityFinding,
  type VulnScanResult,
} from "@/lib/integrations/security";
import { createClientFactory, type AwsClientFactory } from "./client";

/**
 * AWS vulnerability adapter — read-only posture capture across three services:
 *
 *   Inspector2    — software vulnerabilities (EC2/ECS/ECR/lambda)
 *   Security Hub  — security best-practice + config findings
 *   ECR           — container image scan findings (per-repo, per-image)
 *
 * Each service is isolated with `Promise.allSettled` so a denied/unsupported
 * scope (e.g. Inspector2 not enabled) degrades to a partial result instead of
 * aborting the whole account. Everything here is `list`/`describe`/`get` only.
 */

export interface ScanAwsVulnsOpts {
  accountId: string;
}

export async function scanAwsVulns(opts: ScanAwsVulnsOpts): Promise<VulnScanResult> {
  const factory = createClientFactory(opts.accountId);
  const defaultRegion = factory.region;

  const scopes: Array<[string, () => Promise<SecurityFinding[]>]> = [
    [`inspector2:${opts.accountId}`, () => scanInspector2(factory)],
    [`securityhub:${opts.accountId}`, () => scanSecurityHub(factory)],
    [`ecr-scans:${opts.accountId}`, () => scanEcrImages(factory, defaultRegion)],
  ];

  const settled = await Promise.allSettled(scopes.map(([, fn]) => fn()));

  const findings: SecurityFinding[] = [];
  const errors: VulnScanResult["errors"] = [];
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") {
      findings.push(...res.value);
    } else {
      errors.push({ scope: scopes[i][0], message: errMessage(res.reason) });
    }
  });

  return { findings, partial: errors.length > 0, errors };
}

/* -------------------------------------------------------------------------- */
/* Inspector2                                                                 */
/* -------------------------------------------------------------------------- */

interface Inspector2Finding {
  findingArn?: string;
  title?: string;
  description?: string;
  severity?: string;
  inspectorScore?: number;
  resources?: Array<{ id?: string; type?: string }>;
  remediation?: { recommendation?: { url?: string; text?: string } };
  status?: string;
  networkReachability?: { protocol?: string; portRange?: { begin?: number } };
}

async function scanInspector2(factory: AwsClientFactory): Promise<SecurityFinding[]> {
  const client = factory.get(Inspector2Client);
  const findings: SecurityFinding[] = [];

  // Only ACTIVE findings — suppressed/resolved ones are not posture debt.
  for await (const page of paginateListFindings(
    { client },
    {
      filterCriteria: { findingStatus: [{ comparison: "EQUALS", value: "ACTIVE" }] },
    },
  )) {
    for (const f of (page.findings ?? []) as Inspector2Finding[]) {
      const finding = mapInspector2(f, factory.accountId);
      if (finding) findings.push(finding);
    }
  }

  return findings;
}

function mapInspector2(f: Inspector2Finding, accountId: string): SecurityFinding | null {
  const arn = f.findingArn;
  if (!arn || !f.title) return null;
  const resourceArn = f.resources?.[0]?.id ?? arn;
  const rec = f.remediation?.recommendation;
  const exposed = Boolean(f.networkReachability?.portRange?.begin);
  return {
    urn: urnFor("aws", accountId, arn),
    provider: "aws",
    category: "vulnerability",
    title: f.title,
    severity: mapAwsSeverity(f.severity),
    exposed,
    score: typeof f.inspectorScore === "number" ? Math.round(f.inspectorScore) : null,
    details: {
      resourceLink: resourceArn
        ? `https://${regionFromArn(resourceArn)}.console.aws.amazon.com/go/view?id=${encodeURIComponent(resourceArn)}`
        : undefined,
      remediation: rec?.text ?? undefined,
      description: f.description ?? undefined,
      resourceArn,
      resourceType: f.resources?.[0]?.type ?? undefined,
      recommendationUrl: rec?.url ?? undefined,
      source: "inspector2",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Security Hub                                                               */
/* -------------------------------------------------------------------------- */

interface HubFinding {
  Id?: string;
  Title?: string;
  Description?: string;
  Severity?: { Label?: string; Score?: number; Normalized?: number };
  Resources?: Array<{ Id?: string; Type?: string }>;
  Remediation?: { Recommendation?: { Url?: string; Text?: string } };
  Compliance?: { Status?: string };
  ProductFields?: Record<string, string>;
}

async function scanSecurityHub(factory: AwsClientFactory): Promise<SecurityFinding[]> {
  const client = factory.get(SecurityHubClient);
  const findings: SecurityFinding[] = [];

  // Active findings only — ARCHIVED records are historical noise.
  for await (const page of paginateGetFindings(
    { client },
    {
      Filters: { RecordState: [{ Value: "ACTIVE", Comparison: "EQUALS" }] },
    },
  )) {
    for (const f of (page.Findings ?? []) as HubFinding[]) {
      const finding = mapHub(f, factory.accountId);
      if (finding) findings.push(finding);
    }
  }

  return findings;
}

function mapHub(f: HubFinding, accountId: string): SecurityFinding | null {
  const id = f.Id;
  if (!id || !f.Title) return null;
  const resourceId = f.Resources?.[0]?.Id ?? id;
  const rec = f.Remediation?.Recommendation;
  const score = f.Severity?.Normalized ?? f.Severity?.Score;
  return {
    urn: urnFor("aws", accountId, id),
    provider: "aws",
    category: "config",
    title: f.Title,
    severity: mapAwsSeverity(f.Severity?.Label),
    exposed: false,
    score: typeof score === "number" ? Math.round(score) : null,
    details: {
      resourceLink: rec?.Url ?? undefined,
      remediation: rec?.Text ?? undefined,
      description: f.Description ?? undefined,
      resourceId,
      resourceType: f.Resources?.[0]?.Type ?? undefined,
      complianceStatus: f.Compliance?.Status ?? undefined,
      source: "securityhub",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* ECR container image scans                                                  */
/* -------------------------------------------------------------------------- */

interface EcrImageRow {
  imageDigest?: string;
  imageTags?: string[];
  imageScanStatus?: { status?: string };
}

/**
 * Best-effort ECR image scan findings. Inspector2 already covers ECR via the
 * integrated scanning path, but accounts on the legacy ECR scanning config still
 * surface findings here. We enumerate repos, pull the most recent scanned images,
 * and read their scan findings — bounded so a large registry can't stall the scan.
 */
async function scanEcrImages(factory: AwsClientFactory, region: string): Promise<SecurityFinding[]> {
  const ecr = factory.get(ECRClient, { region });
  const findings: SecurityFinding[] = [];

  const repos: { name: string; arn: string }[] = [];
  for await (const page of paginateDescribeRepositories({ client: ecr }, {})) {
    for (const r of page.repositories ?? []) {
      if (r.repositoryName) repos.push({ name: r.repositoryName, arn: r.repositoryArn ?? "" });
    }
  }

  const limit = pLimit(5);
  await Promise.all(
    repos.map((repo) =>
      limit(async () => {
        try {
          // Most recent 20 images per repo — enough to catch the deployed digest.
          const imgRes = await ecr.send(
            new DescribeImagesCommand({ repositoryName: repo.name, maxResults: 20 }),
          );
          const images: EcrImageRow[] = (imgRes.imageDetails ?? []) as EcrImageRow[];
          for (const img of images) {
            const digest = img.imageDigest;
            if (!digest) continue;
            // Only images that were actually scanned yield findings.
            const scanStatus = img.imageScanStatus?.status;
            if (scanStatus !== "COMPLETE" && scanStatus !== "FAILED") continue;

            try {
              const tag = img.imageTags?.[0] ?? "untagged";
              const scan = await ecr.send(
                new DescribeImageScanFindingsCommand({
                  repositoryName: repo.name,
                  imageId: { imageDigest: digest, imageTag: tag },
                }),
              );
              const sevCounts = scan.imageScanFindings?.findingSeverityCounts ?? {};
              const topSev = topSeverity(Object.keys(sevCounts));
              const total = Object.values(sevCounts).reduce((n, c) => n + (c ?? 0), 0);
              if (total === 0) continue;

              findings.push({
                urn: urnFor("aws", factory.accountId, `${repo.arn}@${digest}`),
                provider: "aws",
                category: "container",
                title: `${repo.name}:${tag} — ${total} image vulnerabilit${total === 1 ? "y" : "ies"}`,
                severity: topSev,
                exposed: false,
                score: null,
                details: {
                  resourceLink: `https://${region}.console.aws.amazon.com/ecr/repositories/private/${factory.accountId}/${repo.name}/`,
                  remediation:
                    "Rebuild the image from a patched base tag and redeploy. Inspect the detailed scan findings in the ECR console for the full CVE list.",
                  description: scan.imageScanFindings?.findingSeverityCounts
                    ? `Severity breakdown: ${JSON.stringify(scan.imageScanFindings.findingSeverityCounts)}`
                    : "Container image scan completed with findings.",
                  repository: repo.name,
                  imageTag: tag,
                  imageDigest: digest,
                  severityCounts: sevCounts,
                  source: "ecr-image-scan",
                },
              });
            } catch {
              // A single image lookup failure never aborts the whole registry.
            }
          }
        } catch {
          // Per-repo failure (e.g. no scan config) is non-fatal.
        }
      }),
    ),
  );

  return findings;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function topSeverity(sevs: string[]): SecurityFinding["severity"] {
  const order: SecurityFinding["severity"][] = ["critical", "high", "medium", "low", "info"];
  let best: SecurityFinding["severity"] = "info";
  for (const raw of sevs) {
    const mapped = mapAwsSeverity(raw);
    if (order.indexOf(mapped) < order.indexOf(best)) best = mapped;
  }
  return best;
}

function urnFor(provider: CloudResource["provider"], account: string, id: string): string {
  return makeUrn({ provider, account, region: null, service: "security", nativeId: id });
}

function regionFromArn(arn: string): string {
  const parts = arn.split(":");
  return parts[3] || "ap-south-1";
}

function errMessage(err: unknown): string {
  const e = err as { message?: string; name?: string };
  return e?.message ?? e?.name ?? String(err);
}
