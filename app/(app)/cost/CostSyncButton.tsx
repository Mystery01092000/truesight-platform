"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

/**
 * Cost sync trigger — used as the EmptyState CTA (primary) and as a quiet header
 * action once data exists (tertiary/sm). Fires a POST to the cost sync endpoint and
 * refreshes the route on success so the freshly-captured rows render immediately.
 * Surfaces an inline status + disabled state while the sync runs.
 */
export function CostSyncButton({
  variant = "primary",
  size = "md",
  label = "Sync cost data",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "error">("idle");

  const onSync = async () => {
    setState("syncing");
    try {
      const res = await fetch("/api/cost", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={onSync} disabled={state === "syncing"}>
        {state === "syncing" ? "Syncing…" : state === "error" ? "Retry sync" : label}
      </Button>
      {state === "error" && (
        <span role="alert" className="sr-only">
          Cost sync failed. Use the retry button to try again.
        </span>
      )}
    </>
  );
}
