import { DataTable, StatusBadge, ProviderChip } from "truesight-platform";

type Resource = {
  name: string;
  type: string;
  region: string;
  provider: "aws" | "azure" | "github" | "terraform";
  status: "healthy" | "degraded" | "stopped";
};

const resources: Resource[] = [
  { name: "prod-api-gateway", type: "API Gateway", region: "us-east-1", provider: "aws", status: "healthy" },
  { name: "payments-db-primary", type: "RDS PostgreSQL", region: "us-east-1", provider: "aws", status: "healthy" },
  { name: "cache-cluster-eu", type: "ElastiCache Redis", region: "eu-west-1", provider: "aws", status: "degraded" },
  { name: "vm-batch-worker-03", type: "Virtual Machine", region: "westeurope", provider: "azure", status: "stopped" },
  { name: "assets-cdn-profile", type: "Front Door", region: "global", provider: "azure", status: "healthy" },
  { name: "analytics-eventhub", type: "Event Hub", region: "eastus2", provider: "azure", status: "healthy" },
];

const resourceColumns = [
  {
    accessorKey: "name",
    header: "Resource",
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <span className="font-mono text-[13px] text-ink">{String(getValue())}</span>
    ),
  },
  { accessorKey: "type", header: "Type" },
  {
    accessorKey: "region",
    header: "Region",
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <span className="font-mono text-[13px] text-mute">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    enableSorting: false,
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <ProviderChip provider={getValue() as Resource["provider"]} />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <StatusBadge status={getValue() as Resource["status"]} />
    ),
  },
];

export const ResourceInventory = () => (
  <DataTable columns={resourceColumns} data={resources} />
);

type Finding = {
  finding: string;
  severity: "critical" | "high" | "medium" | "low";
  drift: "drifted" | "missing_in_cloud" | "unmanaged";
  resource: string;
  detected: string;
};

const findings: Finding[] = [
  { finding: "Security group allows 0.0.0.0/0 on port 22", severity: "critical", drift: "drifted", resource: "sg-0f3a91c2", detected: "2h ago" },
  { finding: "S3 bucket versioning disabled outside Terraform", severity: "high", drift: "drifted", resource: "audit-logs-prod", detected: "5h ago" },
  { finding: "IAM role deleted in console, still in state", severity: "high", drift: "missing_in_cloud", resource: "ci-deploy-role", detected: "1d ago" },
  { finding: "Storage account created without IaC coverage", severity: "medium", drift: "unmanaged", resource: "sttempexports01", detected: "2d ago" },
  { finding: "Instance type changed from t3.medium to t3.large", severity: "low", drift: "drifted", resource: "i-0b7d44e19", detected: "3d ago" },
];

const findingColumns = [
  { accessorKey: "finding", header: "Finding" },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <StatusBadge status={getValue() as Finding["severity"]} />
    ),
  },
  {
    accessorKey: "drift",
    header: "Drift",
    enableSorting: false,
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <StatusBadge status={getValue() as Finding["drift"]} className="whitespace-nowrap" />
    ),
  },
  {
    accessorKey: "resource",
    header: "Resource",
    cell: ({ getValue }: { getValue: () => unknown }) => (
      <span className="font-mono text-[13px] text-mute">{String(getValue())}</span>
    ),
  },
  { accessorKey: "detected", header: "Detected" },
];

export const DriftFindings = () => (
  <DataTable columns={findingColumns} data={findings} />
);

const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-south-1"];
const TYPES = ["EC2 Instance", "S3 Bucket", "Lambda Function", "DynamoDB Table"];
const manyResources: Resource[] = Array.from({ length: 14 }, (_, i) => ({
  name: `svc-node-${String(i + 1).padStart(2, "0")}`,
  type: TYPES[i % TYPES.length],
  region: REGIONS[i % REGIONS.length],
  provider: "aws",
  status: i % 5 === 3 ? "degraded" : "healthy",
}));

export const PaginatedInventory = () => (
  <DataTable columns={resourceColumns} data={manyResources} pageSize={5} />
);

export const FilteredEmpty = () => (
  <DataTable
    columns={resourceColumns}
    data={resources}
    globalFilter="kubernetes"
    emptyMessage="No resources match this filter."
  />
);
