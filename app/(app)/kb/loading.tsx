import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * Knowledge Base loading state — icon header, three status tiles, the Ask
 * Argus panel, then the search + uploader split, all as shimmer stand-ins.
 */
export default function KbLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton.Block className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1">
          <Skeleton.Block className="h-7 w-52 max-w-full" />
          <Skeleton.Block className="mt-2 h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-5">
            <Skeleton.Block className="h-3.5 w-24" />
            <Skeleton.Block className="mt-3 h-8 w-20" />
            <Skeleton.Block className="mt-3 h-3 w-28" />
          </Surface>
        ))}
      </div>

      <Surface level={1} radius="lg" className="mt-4 p-5">
        <Skeleton.Block className="h-4 w-28" />
        <Skeleton.Block className="mt-4 h-9 w-full" />
      </Surface>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Surface level={1} radius="lg" className="p-5 lg:col-span-2">
          <Skeleton.Block className="h-4 w-44" />
          <Skeleton.Block className="mt-4 h-9 w-full" />
          <Skeleton.Text lines={3} className="mt-4" />
        </Surface>
        <Surface level={1} radius="lg" className="p-5">
          <Skeleton.Block className="h-4 w-32" />
          <Skeleton.Block className="mt-4 h-24 w-full rounded-md" />
        </Surface>
      </div>

      <Surface level={1} radius="lg" className="mt-4 p-5">
        <Skeleton.Block className="h-4 w-36" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton.Row key={i} />
          ))}
        </div>
      </Surface>
    </div>
  );
}
