import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { StatusBadge } from "@/components/ui/Badge";
import { STATUS_RAIL, statusBadge, type EstateResource } from "@/components/estate/types";

/**
 * ResourceCard — one AWS resource as a compact, clickable row. The kind glyph
 * (AppIconTile) leads, name reads in `text-body`, service + region sit quiet in
 * `text-mute`, and a StatusBadge closes the row. A hairline status rail on the
 * left edge encodes health at a glance. Clicking drills into the account view.
 */
export function ResourceCard({
  resource,
  className,
}: {
  resource: EstateResource;
  className?: string;
}) {
  const { name, service, region, kind, status, account } = resource;
  const badge = statusBadge(status);

  return (
    <Link
      href={`/aws/${encodeURIComponent(account)}`}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-md px-2.5 py-2 pl-3.5",
        "transition-colors hover:bg-surface-elevated focus-visible:bg-surface-elevated",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-[3px] rounded-full",
          STATUS_RAIL[status],
        )}
      />
      <AppIconTile kind={kind} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] leading-[1.6] text-body transition-colors group-hover:text-ink">
          {name}
        </div>
        <div className="truncate text-[12px] leading-[1.5] text-mute">
          {service} · {region}
        </div>
      </div>
      <StatusBadge status={badge.status} label={badge.label} className="shrink-0" />
    </Link>
  );
}
