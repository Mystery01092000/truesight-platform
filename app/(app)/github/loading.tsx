import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * GitHub loading state — icon header, four StatTiles, contributors +
 * languages split, then the repository table stand-in.
 */
export default function GithubLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton.Block className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1">
          <Skeleton.Block className="h-7 w-36" />
          <Skeleton.Block className="mt-2 h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-3.5 w-24" />
            <Skeleton.Block className="mt-3 h-7 w-20" />
          </Surface>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Surface level={1} radius="lg" className="p-5 lg:col-span-2">
          <Skeleton.Block className="h-5 w-44" />
          <div className="mt-4 space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton.Block className="h-3.5 w-1/3" />
                <Skeleton.Block className="h-1 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Surface>
        <Surface level={1} radius="lg" className="p-5">
          <Skeleton.Block className="h-5 w-32" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton.Block key={i} className="h-3 w-full" />
            ))}
          </div>
        </Surface>
      </div>

      <div className="mt-8">
        <Skeleton.Block className="mb-3 h-5 w-40" />
        <Surface level={1} radius="lg" className="p-0">
          <div className="border-b border-hairline bg-surface-elevated px-3.5 py-2.5">
            <Skeleton.Block className="h-4 w-1/2" />
          </div>
          <div className="space-y-0">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-b border-hairline px-3.5 py-3 last:border-0">
                <Skeleton.Block className="h-3.5 w-full" />
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
