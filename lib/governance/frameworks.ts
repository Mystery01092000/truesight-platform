import type { Framework } from "./types";

/**
 * Standard compliance frameworks evaluated by Truesight. Each framework declares a
 * set of controls; every control carries a `ref` that tells the query layer
 * which finding table backs its verified state (`drift`, `security`, or
 * `compliance`). Checklist items reference these same `ruleId`s via their
 * `meta` jsonb so the VerifiedChecklist reflects real estate data.
 */

export const FRAMEWORKS: Record<string, Framework> = {
  "cis-aws": {
    id: "cis-aws",
    name: "CIS AWS Foundations",
    description: "Center for Internet Security benchmark for AWS accounts.",
    controls: [
      {
        ruleId: "cis-aws-1.1",
        title: "Root account usage restricted",
        category: "Security",
        ref: "compliance",
        severity: "critical",
      },
      {
        ruleId: "cis-aws-1.3",
        title: "Unused IAM credentials disabled",
        category: "Security",
        ref: "compliance",
        severity: "high",
      },
      {
        ruleId: "cis-aws-2.1",
        title: "CloudTrail enabled in all regions",
        category: "Operations",
        ref: "compliance",
        severity: "medium",
      },
      {
        ruleId: "cis-aws-3.1",
        title: "S3 bucket access logging enabled",
        category: "Security",
        ref: "compliance",
        severity: "medium",
      },
      {
        ruleId: "cis-aws-4.1",
        title: "No security groups open to 0.0.0.0/0",
        category: "Security",
        ref: "security",
        severity: "high",
      },
      {
        ruleId: "cis-aws-5.1",
        title: "No unrestricted network ACLs",
        category: "Security",
        ref: "security",
        severity: "high",
      },
    ],
  },

  "cis-azure": {
    id: "cis-azure",
    name: "CIS Azure",
    description: "Center for Internet Security benchmark for Azure subscriptions.",
    controls: [
      {
        ruleId: "cis-azure-1.1",
        title: "MFA enabled for all privileged users",
        category: "Security",
        ref: "compliance",
        severity: "critical",
      },
      {
        ruleId: "cis-azure-2.1",
        title: "Activity Log retention at least 365 days",
        category: "Operations",
        ref: "compliance",
        severity: "low",
      },
      {
        ruleId: "cis-azure-6.1",
        title: "RDP access restricted from internet",
        category: "Security",
        ref: "security",
        severity: "high",
      },
      {
        ruleId: "cis-azure-7.1",
        title: "Azure Defender enabled for SQL",
        category: "Security",
        ref: "compliance",
        severity: "medium",
      },
    ],
  },

  soc2: {
    id: "soc2",
    name: "SOC 2",
    description: "Security, availability, and confidentiality controls.",
    controls: [
      {
        ruleId: "soc2-cc1.1",
        title: "Infrastructure changes are tracked",
        category: "Infrastructure",
        ref: "drift",
        severity: "medium",
      },
      {
        ruleId: "soc2-cc7.1",
        title: "Security monitoring detects anomalies",
        category: "Security",
        ref: "security",
        severity: "high",
      },
      {
        ruleId: "soc2-cc7.2",
        title: "Drift from declared state is detected",
        category: "Infrastructure",
        ref: "drift",
        severity: "high",
      },
      {
        ruleId: "soc2-cc8.1",
        title: "Software changes are reviewed",
        category: "Operations",
        ref: "compliance",
        severity: "low",
      },
    ],
  },

  custom: {
    id: "custom",
    name: "Custom",
    description: "Organization-specific governance and operational controls.",
    controls: [
      {
        ruleId: "custom-drift",
        title: "All resources match Terraform state",
        category: "Infrastructure",
        ref: "drift",
        severity: "medium",
      },
      {
        ruleId: "custom-cost-tags",
        title: "Resources carry cost-allocation tags",
        category: "Cost",
        ref: "compliance",
        severity: "low",
      },
      {
        ruleId: "custom-secrets",
        title: "No publicly exposed secrets",
        category: "Security",
        ref: "security",
        severity: "critical",
      },
    ],
  },
};

/** Ordered list for rendering (stable iteration order). */
export const FRAMEWORK_LIST: Framework[] = Object.values(FRAMEWORKS);
