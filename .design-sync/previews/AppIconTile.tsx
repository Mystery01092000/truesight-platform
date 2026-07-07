import { AppIconTile } from "truesight-platform";

export const AccentSweep = () => (
  <div className="flex flex-wrap items-center gap-3">
    <AppIconTile kind="compute" />
    <AppIconTile kind="database" />
    <AppIconTile kind="iam" />
    <AppIconTile kind="serverless" />
    <AppIconTile kind="repo" />
  </div>
);

export const InfraKinds = () => (
  <div className="flex flex-wrap items-center gap-3">
    <AppIconTile kind="container" />
    <AppIconTile kind="network" />
    <AppIconTile kind="cdn" />
    <AppIconTile kind="queue" />
    <AppIconTile kind="storage" />
    <AppIconTile kind="registry" />
  </div>
);

export const SignalKinds = () => (
  <div className="flex flex-wrap items-center gap-3">
    <AppIconTile kind="secret" />
    <AppIconTile kind="ai" />
    <AppIconTile kind="monitoring" />
    <AppIconTile kind="team" />
    <AppIconTile kind="member" />
    <AppIconTile kind="unknown" />
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-end gap-3">
    <AppIconTile kind="database" size={48} />
    <AppIconTile kind="database" size={64} />
  </div>
);
