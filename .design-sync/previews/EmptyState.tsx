import { Button, EmptyState } from "truesight-platform";
import { Radar, SearchX, ShieldAlert } from "lucide-react";

export const UnmappedEstate = () => (
  <EmptyState
    icon={<Radar />}
    title="Truesight hasn't mapped this estate yet."
    description="Trigger a sync to discover your cloud resources across AWS, GCP and Azure."
    action={<Button variant="primary">Run discovery</Button>}
    className="w-full"
  />
);

export const NoFilterMatches = () => (
  <EmptyState
    icon={<SearchX />}
    title="No resources match these filters."
    description="Loosen the provider or environment filters, or clear the search to see the full inventory."
    action={<Button variant="tertiary">Clear filters</Button>}
    className="w-full"
  />
);

export const FeedUnavailable = () => (
  <EmptyState
    icon={<ShieldAlert />}
    title="Findings feed unavailable."
    description="Truesight lost contact with the compliance scanner. It retries automatically every five minutes."
    className="w-full"
  />
);

export const TitleOnly = () => (
  <EmptyState title="No drift detected in this estate." className="w-full" />
);
