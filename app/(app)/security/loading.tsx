import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * Security route skeleton — sketches the scanner console layout (header, stat
 * row, posture counters, findings table) so content resolves in place.
 */
export default function SecurityLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton.Block className="h-6 w-72" />
          <Skeleton.Block className="h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-3.5 w-24" />
            <Skeleton.Block className="mt-3 h-7 w-16" />
          </Surface>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-3.5 w-16" />
            <Skeleton.Block className="mt-3 h-7 w-10" />
          </Surface>
        ))}
      </div>

      <Surface level={1} radius="lg" className="mt-8 p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton.Block className="h-8 w-64" />
          <Skeleton.Block className="h-4 w-20" />
        </div>
        <div className="mt-5 space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton.Row key={i} />
          ))}
        </div>
      </Surface>
    </div>
  );
}
