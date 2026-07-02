import { Surface } from "@/components/ui/Surface";
import { Skeleton } from "@/components/ui/Skeleton";

/** /plans loading sketch — header, three stat tiles, then chat-timeline rows. */
export default function PlansLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-4">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-8 w-16" />
          </Surface>
        ))}
      </div>
      <Surface level={1} radius="lg" className="space-y-6 p-6">
        <Skeleton className="h-3 w-24" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton.Row key={i} />
        ))}
      </Surface>
    </div>
  );
}
