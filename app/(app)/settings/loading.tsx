import { Surface } from "@/components/ui/Surface";
import { Skeleton } from "@/components/ui/Skeleton";

/** /settings loading sketch — header plus the three section cards. */
export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-start gap-3.5">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Surface key={i} level={1} radius="lg" className="p-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
            <div className="mt-4 space-y-3">
              <Skeleton.Row />
              <Skeleton.Row />
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}
