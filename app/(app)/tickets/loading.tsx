import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * Ticketing loading boundary — sketches the tracker layout (header, KPI
 * tiles, filter strip, table rows) so content resolves in place. Shimmer is
 * the sanctioned infinite loop; everything else is static.
 */
export default function TicketsLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-7 w-14" />
          </Surface>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-b border-hairline pb-4">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-4 w-20" />
      </div>

      <Surface level={1} radius="lg" className="mt-5 divide-y divide-hairline">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="px-3.5 py-3">
            <Skeleton.Row />
          </div>
        ))}
      </Surface>
    </div>
  );
}
