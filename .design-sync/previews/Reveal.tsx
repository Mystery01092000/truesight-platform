import { Reveal, Surface, StatTile, StatusBadge } from "truesight-platform";

// Capture-only shim: the harness pins the page clock (clock.setFixedTime), so
// rAF-driven mount animations freeze at their initial opacity-0 frame and the
// cell captures blank. Forcing the prefers-reduced-motion media query makes
// Reveal render its true settled (final) state, which is what a static capture
// should show. Runs once at module scope, before motion first reads the query.
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

export const RevealedStat = () => (
  <Reveal>
    <StatTile label="Resources under watch" value={1284} delta={42} className="w-56" />
  </Reveal>
);

export const StaggeredCards = () => (
  <div className="flex gap-3">
    <Reveal delay={0}>
      <StatTile label="Accounts" value={4} className="w-40" />
    </Reveal>
    <Reveal delay={0.06}>
      <StatTile label="Regions" value={7} className="w-40" />
    </Reveal>
    <Reveal delay={0.12}>
      <StatTile label="Drifted" value={12} delta={-3} className="w-40" />
    </Reveal>
  </div>
);

export const RevealedFinding = () => (
  <Reveal y={16}>
    <Surface level={1} radius="lg" className="flex w-[480px] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium text-ink">Public S3 bucket detected</h3>
        <StatusBadge status="critical" />
      </div>
      <p className="text-[13px] leading-[1.6] text-mute">
        s3://cw-client-exports allows public read via bucket policy. Discovered
        during the 06:00 UTC estate sweep — 2.3 GB of objects exposed.
      </p>
      <span className="font-mono text-[12px] tabular-nums text-mute">
        aws · us-east-1 · account 4821-9932
      </span>
    </Surface>
  </Reveal>
);
