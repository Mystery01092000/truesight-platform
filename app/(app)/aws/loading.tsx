import { Skeleton } from "@/components/ui/Skeleton";
import { Surface } from "@/components/ui/Surface";

/**
 * AWS estate loading state — sketches the discovery console (header, account
 * summary cards, filter strip, table rows) so content resolves in place. The
 * shimmer is the sanctioned infinite loop; everything else stays still.
 */
export default function AwsLoading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton.Block className="h-6 w-40" />
          <Skeleton.Block className="h-4 w-64" />
        </div>
      </div>

      <Skeleton.Block className="mb-3 h-3 w-20" />
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton.Block className="h-4 w-32" />
            <div className="mt-3 flex items-baseline gap-5">
              <Skeleton.Block className="h-6 w-12" />
              <Skeleton.Block className="h-6 w-10" />
              <Skeleton.Block className="h-6 w-10" />
            </div>
            <div className="mt-3.5 flex gap-1.5 border-t border-hairline-soft pt-3">
              <Skeleton.Block className="h-5 w-16 rounded-xs" />
              <Skeleton.Block className="h-5 w-12 rounded-xs" />
            </div>
          </Surface>
        ))}
      </div>

      <Skeleton.Block className="mb-3 h-3 w-20" />
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-hairline pb-4">
        <Skeleton.Block className="h-8 w-64 rounded-md" />
        <Skeleton.Block className="h-4 w-24" />
      </div>
      <Surface level={1} radius="lg" className="divide-y divide-hairline">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton.Row key={i} className="px-3.5 py-3">
            <Skeleton className="size-2 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-1/5" />
            <Skeleton className="h-3.5 w-1/6" />
            <Skeleton className="ml-auto h-5 w-14 rounded-xs" />
          </Skeleton.Row>
        ))}
      </Surface>
    </div>
  );
}
