import { VerifiedChecklist } from "truesight-platform";


// Capture-only shim: the harness pins the page clock (clock.setFixedTime), so
// rAF-driven mount animations freeze at their initial opacity-0 frame and the
// cell captures blank. Forcing the prefers-reduced-motion media query makes
// the component render its true settled state (its useReducedMotion() path).
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) =>
    query.includes("prefers-reduced-motion")
      ? ({
          matches: true,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        } as MediaQueryList)
      : nativeMatchMedia(query);
}

export const ComplianceControls = () => (
  <VerifiedChecklist
    className="max-w-xl"
    title="CIS AWS Foundations"
    entries={[
      {
        id: "cc1",
        label: "Root account MFA enabled",
        description: "Verified against IAM credential report, all 3 accounts.",
        verified: "pass",
      },
      {
        id: "cc2",
        label: "No security groups open to 0.0.0.0/0 on admin ports",
        description: "2 violations found in vpc-prod-east.",
        verified: "fail",
        count: 2,
      },
      {
        id: "cc3",
        label: "S3 buckets block public access",
        description: "1 bucket inherits a legacy account-level exception.",
        verified: "warn",
        count: 1,
      },
      {
        id: "cc4",
        label: "CloudTrail enabled in all regions",
        description: "Multi-region trail truesight-audit active since 2024.",
        verified: "pass",
      },
      {
        id: "cc5",
        label: "EBS volumes encrypted at rest",
        verified: "pass",
      },
      {
        id: "cc6",
        label: "RDS instances not publicly accessible",
        description: "Awaiting first scan of account sandbox-dev.",
        verified: "unknown",
      },
    ]}
  />
);

export const DriftGuardrails = () => (
  <VerifiedChecklist
    className="max-w-xl"
    title="IaC coverage guardrails"
    entries={[
      {
        id: "dg1",
        label: "All production resources under Terraform management",
        description: "14 unmanaged resources detected in account 4821-prod.",
        verified: "fail",
        count: 14,
      },
      {
        id: "dg2",
        label: "No manual changes in the last 7 days",
        description: "3 console edits detected outside change windows.",
        verified: "warn",
        count: 3,
      },
      {
        id: "dg3",
        label: "State files stored in encrypted remote backend",
        description: "S3 backend with SSE-KMS and state locking via DynamoDB.",
        verified: "pass",
      },
      {
        id: "dg4",
        label: "Plan review required before apply",
        description: "Branch protection enforces approval on terraform/ paths.",
        verified: "pass",
      },
    ]}
  />
);

export const AllVerified = () => (
  <VerifiedChecklist
    className="max-w-xl"
    title="Network baseline"
    entries={[
      {
        id: "nb1",
        label: "VPC flow logs enabled",
        verified: "pass",
      },
      {
        id: "nb2",
        label: "Default security groups restrict all traffic",
        verified: "pass",
      },
      {
        id: "nb3",
        label: "NACLs deny inbound RDP from the internet",
        verified: "pass",
      },
    ]}
  />
);
