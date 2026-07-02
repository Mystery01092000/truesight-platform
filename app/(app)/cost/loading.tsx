import { Surface } from "@/components/ui/Surface";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Cost console skeleton — sketches the exact resting layout (header, 4-tile stat row,
 * breakdown surface, line-item table) so content resolves in place without a jump.
 * The shimmer is the sanctioned infinite loop; nothing else moves here.
 */
export default function CostLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton.Block className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton.Block className="h-7 w-48" />
          <Skeleton.Block className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton.Block className="hidden h-8 w-56 sm:block" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-3.5 w-24" />
            <Skeleton.Block className="mt-3 h-7 w-28" />
            <Skeleton.Block className="mt-3 h-3 w-32" />
          </Surface>
        ))}
      </div>

      {/* Breakdown surface */}
      <Surface level={1} radius="lg" className="mt-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton.Block className="h-5 w-36" />
          <Skeleton.Block className="h-3.5 w-40" />
        </div>
        <div className="mt-5 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton.Block key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="grid grid-cols-[minmax(0,180px)_1fr_88px] items-center gap-3">
              <Skeleton.Block className="h-3.5 w-3/4" />
              <Skeleton.Block className="h-2.5 w-full" />
              <Skeleton.Block className="h-3.5 w-full" />
            </div>
          ))}
        </div>
      </Surface>

      {/* Line-item table */}
      <div className="mt-4">
        <Skeleton.Block className="mb-3 h-5 w-28" />
        <Surface level={1} radius="lg" className="overflow-hidden">
          <div className="border-b border-hairline bg-surface-elevated px-3.5 py-2.5">
            <Skeleton.Block className="h-4 w-1/2" />
          </div>
          <div className="divide-y divide-hairline">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="px-3.5 py-3">
                <Skeleton.Block className="h-4 w-full" />
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
