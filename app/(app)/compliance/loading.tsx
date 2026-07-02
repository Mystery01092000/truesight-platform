import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * Compliance loading state — mirrors the resting layout: icon header, four
 * StatTiles, framework coverage + posture gauge, then checklist rows.
 */
export default function ComplianceLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton.Block className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1">
          <Skeleton.Block className="h-7 w-64 max-w-full" />
          <Skeleton.Block className="mt-2 h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-3.5 w-28" />
            <Skeleton.Block className="mt-3 h-7 w-20" />
            <Skeleton.Block className="mt-3 h-3 w-24" />
          </Surface>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <Skeleton.Block className="mb-3 h-4 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Surface key={i} level={1} radius="lg" className="p-4">
                <Skeleton.Block className="h-4 w-32" />
                <Skeleton.Block className="mt-3 h-1 w-full rounded-full" />
                <Skeleton.Block className="mt-3 h-3 w-24" />
              </Surface>
            ))}
          </div>
        </div>
        <Surface level={1} radius="lg" className="grid place-items-center p-6">
          <Skeleton.Block className="size-32 rounded-full" />
        </Surface>
      </div>

      <div className="mt-8">
        <Skeleton.Block className="mb-4 h-4 w-36" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((col) => (
            <div key={col} className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton.Row
                  key={i}
                  className="rounded-md border border-hairline bg-surface px-3 py-2.5"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
