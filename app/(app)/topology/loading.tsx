import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Topology loading state — sketches the exact layout being loaded (header,
 * toolbar row, canvas with ghost node cards) so the weave resolves in place
 * instead of flashing in from blank. Shimmer is the sanctioned loop.
 */
export default function TopologyLoading() {
  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col">
      <header className="mb-3">
        <div className="mb-3">
          <Skeleton.Block className="h-7 w-36" />
          <Skeleton.Block className="mt-2 h-4 w-96 max-w-full" />
        </div>
        {/* toolbar row: provider pills · scope pills · layout select · legend */}
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton.Block className="h-8 w-44 rounded-full" />
          <Skeleton.Block className="h-8 w-72 rounded-full" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton.Block className="h-8 w-24 rounded-md" />
            <Skeleton.Block className="h-8 w-20 rounded-md" />
            <Skeleton.Block className="h-4 w-28" />
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden rounded-xl border border-hairline bg-surface p-8">
        {/* ghost account band */}
        <div className="h-full rounded-[20px] border border-hairline-soft p-6">
          <Skeleton.Block className="h-6 w-52 rounded-full" />
          <div className="mt-8 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-hairline-soft bg-surface-card px-3 py-4"
              >
                <Skeleton className="size-12 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
