import { Surface } from "truesight-platform";

const LADDER_LABELS = ["canvas", "surface", "elevated", "card"] as const;

export const Ladder = () => (
  <div className="flex flex-wrap gap-4">
    {([0, 1, 2, 3] as const).map((level) => (
      <Surface key={level} level={level} className="w-40 p-4">
        <div className="text-label font-medium text-mute">level {level}</div>
        <div className="mt-1 text-[14px] text-body">{LADDER_LABELS[level]}</div>
      </Surface>
    ))}
  </div>
);

export const CardComposition = () => (
  <Surface level={3} className="w-80 p-5">
    <div className="text-label font-medium text-mute">Production account</div>
    <div className="mt-1 text-[15px] font-medium text-ink">arcane-prod · 404063516552</div>
    <p className="mt-2 text-[13px] leading-relaxed text-mute">
      212 resources across 4 regions. Last discovery sync finished 6 minutes
      ago with no drift detected.
    </p>
    <Surface level={2} radius="md" className="mt-4 p-3">
      <span className="font-mono text-[12px] text-body">
        arn:aws:iam::404063516552:role/truesight-readonly
      </span>
    </Surface>
  </Surface>
);

export const Radii = () => (
  <div className="flex flex-wrap items-end gap-4">
    {(["none", "sm", "md", "lg", "xl"] as const).map((radius) => (
      <Surface key={radius} level={2} radius={radius} className="p-4">
        <span className="font-mono text-[12px] text-body">{radius}</span>
      </Surface>
    ))}
  </div>
);
