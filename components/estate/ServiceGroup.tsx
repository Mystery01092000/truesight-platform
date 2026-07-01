import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Surface } from "@/components/ui/Surface";
import { AppIconTile } from "@/components/ui/AppIconTile";
import { Badge } from "@/components/ui/Badge";
import { ResourceCard } from "@/components/estate/ResourceCard";
import { kindLabel, type ServiceGroupData } from "@/components/estate/types";

/** How many resource rows to preview before collapsing into "+N more". */
const PREVIEW = 4;

/**
 * ServiceGroup — a Surface card bucketing one AWS service. The service kind
 * glyph leads, the service name and a region sub-facet label sit beside it, and
 * a count chip anchors the corner. Below a hairline divider, a compact list of
 * ResourceCards previews the members (each carrying its own status rail).
 */
export function ServiceGroup({
  group,
  className,
}: {
  group: ServiceGroupData;
  className?: string;
}) {
  const { service, kind, regions, count, resources, account } = group;
  const preview = resources.slice(0, PREVIEW);
  const remaining = count - preview.length;

  const regionLabel =
    regions.length === 1 ? regions[0] : `${regions.length} regions`;

  return (
    <Surface level={1} radius="lg" className={cn("flex flex-col p-4", className)}>
      <div className="flex items-start gap-3">
        <AppIconTile kind={kind} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            {service}
          </div>
          <div className="mt-0.5 truncate text-[12px] leading-[1.5] text-mute">
            {kindLabel(kind)} · {regionLabel}
          </div>
        </div>
        <Badge className="shrink-0 tabular-nums">{count}</Badge>
      </div>

      <div className="mt-3 -mx-1.5 border-t border-hairline pt-2">
        <div className="flex flex-col gap-0.5">
          {preview.map((r) => (
            <ResourceCard key={r.urn} resource={r} />
          ))}
        </div>
        {remaining > 0 && (
          <Link
            href={`/aws/${encodeURIComponent(account)}`}
            className="mt-1 inline-flex items-center px-2.5 py-1 text-[12px] leading-[1.5] text-mute transition-colors hover:text-body"
          >
            +{remaining} more {remaining === 1 ? "resource" : "resources"}
          </Link>
        )}
      </div>
    </Surface>
  );
}
