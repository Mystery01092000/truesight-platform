import { cn } from "@/lib/utils/cn";

/**
 * Skeleton — composable loading placeholders over the global `.skeleton`
 * shimmer (one of the two sanctioned infinite loops, with live-status dots).
 * Compose Skeleton.Block / .Text / .Row to sketch the layout being loaded so
 * content resolves in place instead of jumping.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden {...props} />;
}

/** A single sized block — size it with height/width utility classes. */
function Block({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-4 w-full", className)} {...props} />;
}

/** A paragraph stand-in: `lines` shimmer rows, the last one short. */
function Text({
  lines = 3,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden {...props}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3.5", lines > 1 && i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/** A list-row stand-in: icon tile + two-line copy. Pass children to override. */
function Row({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden {...props}>
      {children ?? (
        <>
          <Skeleton className="size-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </>
      )}
    </div>
  );
}

Skeleton.Block = Block;
Skeleton.Text = Text;
Skeleton.Row = Row;
