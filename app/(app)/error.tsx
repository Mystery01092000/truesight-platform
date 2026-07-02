"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";

/**
 * Global error boundary for the authenticated app section. Renders an
 * Argus-persona error surface — never a blank screen or raw stack trace.
 * The reset() call re-attempts the segment render.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[argus] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-6xl items-center justify-center py-20">
      <Surface
        level={1}
        radius="lg"
        className="flex flex-col items-center px-6 py-16 text-center"
      >
        <div className="mb-4 grid size-12 place-items-center rounded-lg border border-hairline bg-surface-card">
          <AlertTriangle size={24} className="text-accent-yellow" />
        </div>
        <h2 className="font-display text-[18px] font-medium leading-[1.4] text-ink">
          Argus lost sight of this view
        </h2>
        <p className="mt-2 max-w-sm text-[14px] leading-[1.6] text-mute">
          Something went wrong rendering this page. The estate data is safe — try
          again, or navigate elsewhere from the sidebar.
        </p>
        <div className="mt-5">
          <Button variant="tertiary" size="sm" onClick={reset}>
            <RefreshCw size={14} />
            Try again
          </Button>
        </div>
      </Surface>
    </div>
  );
}
