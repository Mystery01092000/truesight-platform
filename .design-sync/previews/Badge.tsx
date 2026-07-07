import { Badge } from "truesight-platform";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge variant="badge">terraform-managed</Badge>
    <Badge variant="info-soft">New</Badge>
  </div>
);

export const NeutralLabels = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge>us-east-1</Badge>
    <Badge>prod-payments</Badge>
    <Badge>rg-core-network</Badge>
    <Badge>t3.medium</Badge>
  </div>
);

export const InfoSoftTags = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Badge variant="info-soft">Beta</Badge>
    <Badge variant="info-soft">Preview</Badge>
    <Badge variant="info-soft">12 new findings</Badge>
  </div>
);
