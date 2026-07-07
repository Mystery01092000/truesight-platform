import { PageHeader, Button, PillTabs, StatusBadge } from "truesight-platform";
import { Boxes, Download, RefreshCw } from "lucide-react";

export const PillarScreen = () => (
  <PageHeader
    icon={<Boxes size={22} className="text-iris" />}
    iconTone="iris"
    eyebrow="Inventory"
    title="Resources"
    description="Every resource discovered across your connected AWS and Azure accounts, matched against Terraform state."
    actions={
      <>
        <Button variant="tertiary" size="sm">
          <Download size={14} />
          Export
        </Button>
        <Button size="sm">
          <RefreshCw size={14} />
          Sync now
        </Button>
      </>
    }
  />
);

export const DetailScreen = () => (
  <PageHeader
    eyebrow="Resource"
    title="prod-api-gateway"
    titleClassName="font-mono"
    description={
      <>
        API Gateway in us-east-1 · account 4821-prod · <StatusBadge status="drifted" />
      </>
    }
    actions={<Button variant="secondary" size="sm">View in AWS console</Button>}
  />
);

export const WithFilterRow = () => (
  <PageHeader
    title="Drift findings"
    description="Changes detected between cloud reality and your declared infrastructure."
    actions={<Button size="sm">Run scan</Button>}
  >
    <PillTabs
      value="open"
      onChange={() => {}}
      aria-label="Finding state"
      items={[
        { value: "open", label: "Open" },
        { value: "acknowledged", label: "Acknowledged" },
        { value: "resolved", label: "Resolved" },
        { value: "all", label: "All" },
      ]}
    />
  </PageHeader>
);

export const TitleOnly = () => <PageHeader title="Settings" />;
