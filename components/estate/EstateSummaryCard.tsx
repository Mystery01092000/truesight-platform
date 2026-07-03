import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { RollupNumber } from "@/components/ui/RollupNumber";
import type { EstateGroupSummary } from "@/components/estate/types";

/** How many environment chips render before collapsing into "+N". */
const ENV_PREVIEW = 3;

/**
 * EstateSummaryCard — the consolidated discovery-console card for one AWS
 * account or Azure resource group. StatTile vocabulary (quiet label, mono
 * tabular figures) with a drift signal and environment chips; the whole card
 * links into the group drill-down. Elevation is the surface ladder + hairline,
 * hover lifts the edge only (150ms) — never a shadow.
 */
export function EstateSummaryCard({
  summary,
  href,
  className,
}: {
  summary: EstateGroupSummary;
  href: string;
  className?: string;
}) {
  const { id, resourceCount, serviceCount, regionCount, driftCount, environments, degraded, stopped } =
    summary;
  const envs = environments.slice(0, ENV_PREVIEW);
  const envRest = environments.length - envs.length;

  const metrics = [
    { label: resourceCount === 1 ? "resource" : "resources", value: resourceCount },
    { label: serviceCount === 1 ? "service" : "services", value: serviceCount },
    { label: regionCount === 1 ? "region" : "regions", value: regionCount },
  ];

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lg border border-hairline bg-surface p-4",
        "transition-colors duration-150 ease-smooth hover:border-hairline-strong hover:bg-surface-elevated",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[14px] font-medium leading-[1.5] text-ink tabular-nums">
          {id}
        </span>
        <ArrowUpRight
          size={14}
          aria-hidden
          className="mt-0.5 shrink-0 text-stone transition-colors duration-150 ease-smooth group-hover:text-mute"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
        {metrics.map((m) => (
          <span key={m.label} className="flex items-baseline gap-1.5">
            <RollupNumber
              value={m.value}
              className="font-mono text-[22px] font-medium leading-none text-ink"
            />
            <span className="text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
              {m.label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-hairline-soft pt-3">
        {driftCount > 0 ? (
          <StatusBadge
            status="drifted"
            label={`${driftCount} drift`}
            className="shrink-0 tabular-nums"
          />
        ) : (
          <StatusBadge status="in_sync" className="shrink-0" />
        )}
        {stopped > 0 && (
          <StatusBadge status="stopped" label={`${stopped} stopped`} className="shrink-0 tabular-nums" />
        )}
        {degraded > 0 && (
          <StatusBadge status="degraded" label={`${degraded} degraded`} className="shrink-0 tabular-nums" />
        )}
        {envs.map((env) => (
          <Badge key={env} className="font-mono text-micro">
            {env}
          </Badge>
        ))}
        {envRest > 0 && <Badge className="font-mono text-micro tabular-nums">+{envRest}</Badge>}
        {environments.length === 0 && (
          <span className="text-micro leading-[1.4] text-ash">no env tags</span>
        )}
      </div>
    </Link>
  );
}
