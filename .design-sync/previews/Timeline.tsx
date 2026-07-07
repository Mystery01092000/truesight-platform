import { Timeline, StatusBadge, Badge } from "truesight-platform";
import { Cloud, GitPullRequest, RefreshCw } from "lucide-react";


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

const dot = (tone: string) => (
  <span className={`block size-2.5 rounded-full border-2 border-surface ${tone}`} />
);

export const SyncHistory = () => (
  <Timeline
    className="max-w-xl"
    items={[
      {
        id: "s1",
        marker: dot("bg-accent-green"),
        title: (
          <>
            <span className="font-medium text-ink">Estate sync completed</span>
            <StatusBadge status="in_sync" />
          </>
        ),
        timestamp: "14:32",
        body: "1,284 resources scanned across 3 accounts — no new drift detected.",
      },
      {
        id: "s2",
        marker: dot("bg-accent-yellow"),
        title: (
          <>
            <span className="font-medium text-ink">Drift detected</span>
            <StatusBadge status="drifted" />
          </>
        ),
        timestamp: "11:07",
        body: "sg-0f3a91c2 ingress rules changed outside Terraform (2 findings).",
      },
      {
        id: "s3",
        title: <span className="font-medium text-ink">Plan applied via CI</span>,
        timestamp: "09:48",
        body: "terraform apply on release/2026-07 — 6 resources changed, 0 destroyed.",
      },
      {
        id: "s4",
        marker: dot("bg-accent-red"),
        title: (
          <>
            <span className="font-medium text-ink">Sync failed</span>
            <StatusBadge status="stopped" label="Auth error" />
          </>
        ),
        timestamp: "Yesterday",
        body: "Azure credential for subscription core-prod expired; discovery skipped.",
      },
      {
        id: "s5",
        title: <span className="font-medium text-ink">Scheduled discovery started</span>,
        timestamp: "Yesterday",
      },
    ]}
  />
);

export const ActivityFeed = () => (
  <Timeline
    variant="chat"
    className="max-w-xl"
    items={[
      {
        id: "c1",
        marker: "PK",
        title: (
          <>
            <span className="font-medium text-ink">Priya Kapoor</span>
            <Badge>Owner</Badge>
          </>
        ),
        timestamp: "2m ago",
        body: "Acknowledged the SSH drift finding — remediation PR is up for review.",
      },
      {
        id: "c2",
        marker: <GitPullRequest />,
        title: <span className="font-medium text-ink">Pull request #482 opened</span>,
        timestamp: "18m ago",
        body: "fix: restrict sg-0f3a91c2 ingress to bastion CIDR (terraform/network).",
      },
      {
        id: "c3",
        marker: <RefreshCw />,
        title: <span className="font-medium text-ink">Re-scan requested</span>,
        timestamp: "1h ago",
        body: "Targeted re-scan of vpc-prod-east after manual change window closed.",
      },
      {
        id: "c4",
        marker: <Cloud />,
        title: <span className="font-medium text-ink">Truesight discovery</span>,
        timestamp: "3h ago",
        body: "Imported 12 unmanaged resources from account 4821-prod into the inventory.",
      },
    ]}
  />
);

export const EmptyState = () => (
  <Timeline items={[]} emptyMessage="No sync events recorded for this resource yet." />
);
