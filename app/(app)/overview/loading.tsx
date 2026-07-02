import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * Overview loading state — sketches the exact resting layout (header, four
 * StatTiles, spend row, estate card) so content resolves in place.
 */
export default function OverviewLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <Skeleton.Block className="h-7 w-44" />
        <Skeleton.Block className="mt-2 h-4 w-80 max-w-full" />
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

      <Surface level={1} radius="lg" className="mt-4 p-4">
        <Skeleton.Block className="h-3.5 w-32" />
        <Skeleton.Block className="mt-3 h-7 w-36" />
      </Surface>

      <Surface level={1} radius="lg" className="mt-4 p-6">
        <Skeleton.Block className="h-5 w-40" />
        <Skeleton.Text lines={2} className="mt-3 max-w-md" />
      </Surface>
    </div>
  );
}
