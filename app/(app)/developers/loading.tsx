import { Surface } from "@/components/ui/Surface";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Developer Portal loading state — sketches the exact index layout (header,
 * four stat tiles, filter strip, directory table) with the sanctioned skeleton
 * shimmer so real content resolves in place without a jump.
 */
export default function DevelopersLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton.Block className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton.Block className="h-6 w-48" />
          <Skeleton.Block className="h-4 w-80 max-w-full" />
        </div>
      </div>

      {/* Stat tile row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-3.5 w-24" />
            <Skeleton.Block className="mt-3 h-8 w-28" />
          </Surface>
        ))}
      </div>

      {/* Directory: filter strip + table */}
      <div className="mt-8">
        <Skeleton.Block className="mb-4 h-5 w-32" />
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-4">
          <Skeleton.Block className="h-8 w-64 max-w-full rounded-md" />
          <Skeleton.Block className="h-4 w-24" />
        </div>
        <Surface level={1} radius="lg" className="mt-4 p-4">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton.Row key={i}>
                <Skeleton.Block className="size-7 shrink-0 rounded-full" />
                <Skeleton.Block className="h-3.5 w-1/4" />
                <Skeleton.Block className="h-3.5 w-16" />
                <Skeleton.Block className="ml-auto h-3.5 w-20" />
              </Skeleton.Row>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
