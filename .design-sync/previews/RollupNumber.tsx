import { RollupNumber, Surface } from "truesight-platform";

export const LiveResourceCount = () => (
  <div className="flex flex-col gap-1">
    <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
      Resources under watch
    </span>
    <RollupNumber value={1284} className="text-[32px] font-semibold leading-none text-ink" />
  </div>
);

export const MonthlySpendCurrency = () => (
  <div className="flex flex-col gap-1">
    <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
      Monthly cloud spend
    </span>
    <RollupNumber
      value={48213.37}
      prefix="$"
      decimals={2}
      className="text-[32px] font-semibold leading-none text-ink"
    />
  </div>
);

export const CompliancePercent = () => (
  <div className="flex flex-col gap-1">
    <span className="text-[12px] font-medium uppercase tracking-wide text-mute">
      Policies in compliance
    </span>
    <RollupNumber
      value={98.6}
      decimals={1}
      suffix="%"
      className="text-[32px] font-semibold leading-none text-accent-green"
    />
  </div>
);

export const EstateCounterRow = () => (
  <Surface level={1} radius="lg" className="flex items-center gap-8 px-6 py-4">
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-mute">Accounts</span>
      <RollupNumber value={4} className="text-[20px] font-semibold text-ink" />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-mute">Regions</span>
      <RollupNumber value={7} className="text-[20px] font-semibold text-ink" />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-mute">Drift findings</span>
      <RollupNumber value={12} className="text-[20px] font-semibold text-accent-yellow" />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-mute">Critical</span>
      <RollupNumber value={2} className="text-[20px] font-semibold text-accent-red" />
    </div>
  </Surface>
);
