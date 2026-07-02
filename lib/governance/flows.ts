import type { GuidedFlowDef } from "./types";

/**
 * Guided compliance workflow definitions — step templates for the GuidedFlow
 * shell. The dashboard renders the first two ("Remediate drift" and "Resolve
 * security findings") with real finding data resolved from the query layer;
 * "Onboard a new service" is available for the onboarding journey.
 *
 * Each step carries a label (shown on the stepper rail) and a description
 * (shown in the expanded content area). The automated check for each step is
 * implicit in the step's position: step 0 is the detection gate — if there is
 * nothing to remediate the entire flow resolves to "done".
 */
export const GUIDED_FLOWS: GuidedFlowDef[] = [
  {
    id: "remediate-drift",
    title: "Remediate drift",
    description: "Reconcile resources that have drifted from Terraform state.",
    steps: [
      {
        id: "detect",
        label: "Detect",
        description: "Identify resources out of sync with their declared Terraform state.",
      },
      {
        id: "review",
        label: "Review",
        description: "Examine the attribute diffs and classification for each drifted resource.",
      },
      {
        id: "plan",
        label: "Plan",
        description: "Decide whether to re-apply the Terraform source or update the declaration.",
      },
      {
        id: "verify",
        label: "Verify",
        description: "Run a sync to confirm drift is resolved and the estate is clean.",
      },
    ],
  },

  {
    id: "resolve-security",
    title: "Resolve security findings",
    description: "Close critical and high-severity exposure findings across the estate.",
    steps: [
      {
        id: "triage",
        label: "Triage",
        description: "Rank findings by severity and whether the resource is exposed.",
      },
      {
        id: "review",
        label: "Review",
        description: "Inspect each critical / high exposure and its remediation guidance.",
      },
      {
        id: "remediate",
        label: "Remediate",
        description: "Apply the fix, tighten the policy, or quarantine the resource.",
      },
      {
        id: "verify",
        label: "Verify",
        description: "Re-scan to confirm the finding is closed and posture has improved.",
      },
    ],
  },

  {
    id: "onboard-service",
    title: "Onboard a new service",
    description: "Bring a new cloud service under Argus governance.",
    steps: [
      {
        id: "connect",
        label: "Connect",
        description: "Add the integration account or subscription.",
      },
      {
        id: "sync",
        label: "Sync",
        description: "Run a discovery sync to map resources read-only.",
      },
      {
        id: "tag",
        label: "Tag",
        description: "Apply ownership and cost tags to discovered resources.",
      },
      {
        id: "baseline",
        label: "Baseline",
        description: "Pin the Terraform state as the compliance baseline.",
      },
    ],
  },
];
