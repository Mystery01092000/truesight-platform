import { Skeleton } from "truesight-platform";

export const Blocks = () => (
  <div className="w-80 space-y-3">
    <Skeleton className="h-6 w-2/5" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-24 w-full rounded-lg" />
  </div>
);

export const Paragraph = () => <Skeleton.Text lines={4} className="w-80" />;

export const ResourceListLoading = () => (
  <div className="w-96 space-y-4">
    <Skeleton.Row />
    <Skeleton.Row />
    <Skeleton.Row />
    <Skeleton.Row />
  </div>
);

export const CardLoading = () => (
  <div className="w-80 rounded-lg border border-hairline bg-surface p-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-10" />
    </div>
    <Skeleton className="mt-3 h-8 w-28" />
    <Skeleton.Text lines={2} className="mt-4" />
  </div>
);
