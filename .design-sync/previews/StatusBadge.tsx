import { StatusBadge } from "truesight-platform";

export const SeverityScale = () => (
  <div className="flex flex-wrap items-center gap-3">
    <StatusBadge status="critical" />
    <StatusBadge status="high" />
    <StatusBadge status="medium" />
    <StatusBadge status="low" />
    <StatusBadge status="info" />
  </div>
);

export const DriftStates = () => (
  <div className="flex flex-wrap items-center gap-3">
    <StatusBadge status="in_sync" />
    <StatusBadge status="drifted" />
    <StatusBadge status="missing_in_cloud" />
    <StatusBadge status="unmanaged" />
    <StatusBadge status="unknown" />
  </div>
);

export const ResourceHealth = () => (
  <div className="flex flex-wrap items-center gap-3">
    <StatusBadge status="healthy" />
    <StatusBadge status="degraded" />
    <StatusBadge status="stopped" />
  </div>
);

export const NoDot = () => (
  <div className="flex flex-wrap items-center gap-3">
    <StatusBadge status="critical" dot={false} />
    <StatusBadge status="drifted" dot={false} />
    <StatusBadge status="healthy" dot={false} />
  </div>
);

export const CustomLabels = () => (
  <div className="flex flex-wrap items-center gap-3">
    <StatusBadge status="critical" label="3 critical findings" />
    <StatusBadge status="drifted" label="Drifted 2h ago" />
    <StatusBadge status="in_sync" label="Plan clean" />
  </div>
);
