import { StatTile, Sparkline } from "truesight-platform";

export const ResourceCount = () => (
  <StatTile label="Resources" value={1284} delta={42} className="w-56" />
);

export const MonthlySpend = () => (
  <StatTile
    label="Monthly spend"
    value={4821.37}
    decimals={2}
    prefix="$"
    delta={6.2}
    deltaInverted
    deltaSuffix="%"
    className="w-56"
  />
);

export const WithSparkline = () => (
  <StatTile
    label="Daily burn"
    value={161.4}
    decimals={1}
    prefix="$"
    delta={-3.8}
    deltaInverted
    deltaSuffix="%"
    sparkline={
      <Sparkline
        data={[142, 155, 149, 161, 172, 168, 164, 158, 161]}
        width={200}
        height={32}
      />
    }
    className="w-64"
  />
);

export const ZeroDelta = () => (
  <StatTile label="Open critical findings" value={0} delta={0} className="w-56" />
);
