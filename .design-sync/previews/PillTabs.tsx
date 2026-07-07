import { PillTabs } from "truesight-platform";

const noop = () => {};

export const ProviderScope = () => (
  <PillTabs
    aria-label="Provider scope"
    value="aws"
    onChange={noop}
    items={[
      { value: "all", label: "All providers" },
      { value: "aws", label: "AWS" },
      { value: "gcp", label: "GCP" },
      { value: "azure", label: "Azure" },
    ]}
  />
);

export const FindingSeverity = () => (
  <PillTabs
    aria-label="Finding severity"
    value="critical"
    onChange={noop}
    items={[
      { value: "all", label: "All findings" },
      { value: "critical", label: "Critical" },
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
      { value: "low", label: "Low" },
    ]}
  />
);

export const FirstTabActive = () => (
  <PillTabs
    aria-label="Estate view"
    value="topology"
    onChange={noop}
    items={[
      { value: "topology", label: "Topology" },
      { value: "inventory", label: "Inventory" },
      { value: "drift", label: "Drift" },
    ]}
  />
);
