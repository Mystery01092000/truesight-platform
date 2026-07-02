import type { TokenCredential } from "@azure/identity";

import type { Severity } from "@/lib/taxonomy";
import type { CloudProvider } from "@/lib/taxonomy";
import type { SecurityFinding, VulnScanResult } from "@/lib/integrations/security";
import { makeUrn } from "@/lib/integrations/types";
import {
  createAzureCredential,
  createResourceGraphClient,
  readAzureEnv,
  resolveSubscription,
} from "./client";

/**
 * Azure Defender / Microsoft Defender for Cloud adapter — read-only posture
 * capture via a single Resource Graph KQL query over the
 * `microsoft.security/assessments` resource type.
 *
 * Each assessment row carries a status (Healthy/Unhealthy), a severity tier, and
 * links to the assessed resource. We map Unhealthy assessments into the canonical
 * {@link SecurityFinding} shape; Healthy ones are not posture debt and are skipped.
 */

/**
 * Microsoft Defender severity tiers are strings on the assessment:
 *   "High" / "Medium" / "Low" — plus an occasional numeric "score".
 */
function mapDefenderSeverity(raw?: string | null): Severity {
  switch ((raw ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "informational":
    case "info":
      return "info";
    default:
      return "medium";
  }
}

interface DefenderAssessmentRow {
  id: string;
  name?: string;
  type?: string;
  location?: string;
  properties?: {
    displayName?: string;
    description?: string;
    status?: { code?: string; cause?: string; severity?: string };
    resourceDetails?: {
      Source?: string;
      Id?: string;
      AzureResourceId?: string;
    };
    remediationSteps?: string[];
    additionalData?: Record<string, unknown>;
    links?: { azurePortal?: string };
  };
}

const KQL =
  "SecurityResources | where type == 'microsoft.security/assessments' " +
  "| project id, name, type, location, properties";

export async function scanAzureVulns(): Promise<VulnScanResult> {
  const errors: VulnScanResult["errors"] = [];
  const findings: SecurityFinding[] = [];

  let credential: TokenCredential;
  let subscriptionId: string;
  try {
    const env = readAzureEnv();
    credential = createAzureCredential(env);
    subscriptionId = (await resolveSubscription(credential, env.subscriptionName)).subscriptionId;
  } catch (err) {
    return {
      findings: [],
      partial: true,
      errors: [{ scope: "azure:resolve-subscription", message: errMsg(err) }],
    };
  }

  try {
    const client = createResourceGraphClient(credential);
    const rows: DefenderAssessmentRow[] = [];

    let skipToken: string | undefined;
    do {
      const resp = await client.resources({
        subscriptions: [subscriptionId],
        query: KQL,
        options: { resultFormat: "objectArray", top: 1000, skipToken },
      });
      const data = resp.data;
      if (Array.isArray(data)) {
        for (const row of data as DefenderAssessmentRow[]) {
          if (row && typeof row.id === "string" && row.id) rows.push(row);
        }
      }
      skipToken = resp.skipToken;
    } while (skipToken);

    for (const row of rows) {
      const finding = mapDefenderAssessment(row, subscriptionId);
      if (finding) findings.push(finding);
    }
  } catch (err) {
    errors.push({ scope: `azure:defender:${subscriptionId}`, message: errMsg(err) });
  }

  return { findings, partial: errors.length > 0, errors };
}

function mapDefenderAssessment(
  row: DefenderAssessmentRow,
  subscriptionId: string,
): SecurityFinding | null {
  const props = row.properties ?? {};
  const status = props.status?.code ?? "";
  // Only Unhealthy assessments are posture debt; Healthy/NotApplicable are skipped.
  if (status !== "Unhealthy") return null;

  const displayName = props.displayName ?? row.name ?? "Defender assessment";
  const resourceId =
    props.resourceDetails?.AzureResourceId ?? props.resourceDetails?.Id ?? row.id;
  const remediation = props.remediationSteps?.join(" ") ?? undefined;

  return {
    urn: urnFor("azure", subscriptionId, row.id),
    provider: "azure",
    category: "defender",
    title: displayName,
    severity: mapDefenderSeverity(props.status?.severity),
    exposed: false,
    score: null,
    details: {
      resourceLink: props.links?.azurePortal ?? azureResourceLink(resourceId, subscriptionId),
      remediation,
      description: props.description ?? undefined,
      resourceId,
      cause: props.status?.cause ?? undefined,
      source: "defender",
    },
  };
}

function urnFor(provider: CloudProvider, account: string, id: string): string {
  return makeUrn({ provider, account, region: null, service: "security", nativeId: id });
}

function azureResourceLink(resourceId: string | undefined, subscriptionId: string): string | undefined {
  if (!resourceId) return undefined;
  return `https://portal.azure.com/#blade/Microsoft_Azure_Security/SecurityMenuBlade/~/${subscriptionId}`;
}

function errMsg(err: unknown): string {
  const e = err as { message?: string; name?: string };
  return e?.message ?? e?.name ?? String(err);
}
