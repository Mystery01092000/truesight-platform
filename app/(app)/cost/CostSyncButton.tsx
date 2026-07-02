"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Cost sync trigger — the EmptyState CTA. Fires a POST to the cost sync endpoint and
 * refreshes the route on success so the freshly-captured rows render immediately.
 * Surfaces an inline status + disabled state while the sync runs.
 */
export function CostSyncButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "syncing" | "error">("idle");

  const onSync = async () => {
    setState("syncing");
    try {
      const res = await fetch("/api/cost", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <Button onClick={onSync} disabled={state === "syncing"}>
      {state === "syncing" ? "Syncing…" : state === "error" ? "Retry sync" : "Sync cost data"}
    </Button>
  );
}
