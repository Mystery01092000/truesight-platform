import { Button } from "truesight-platform";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button variant="primary">Connect estate</Button>
    <Button variant="secondary">Learn more</Button>
    <Button variant="tertiary">View findings</Button>
    <Button variant="install">Install</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button size="md">Run discovery</Button>
    <Button size="sm">Run discovery</Button>
    <Button variant="tertiary" size="md">
      Export report
    </Button>
    <Button variant="tertiary" size="sm">
      Export report
    </Button>
  </div>
);

export const DisabledStates = () => (
  <div className="flex flex-wrap items-center gap-3">
    <Button disabled>Sync running…</Button>
    <Button variant="tertiary" disabled>
      Awaiting approval
    </Button>
  </div>
);
