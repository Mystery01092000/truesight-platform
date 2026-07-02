"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";

/**
 * DevRefreshButton — the "Refresh stats" CTA for operators+. Fires the
 * POST /api/developers refresh (busts the LOC cache, recomputes the summary
 * and re-materializes `developer_stats`) then refreshes the route so freshly
 * computed rows render in place. Mirrors the CostSyncButton pattern.
 */
export function DevRefreshButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "refreshing" | "error">("idle");

  const onRefresh = async () => {
    setState("refreshing");
    try {
      const res = await fetch("/api/developers", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <Button onClick={onRefresh} disabled={state === "refreshing"}>
      {state === "refreshing"
        ? "Refreshing…"
        : state === "error"
          ? "Retry refresh"
          : "Refresh stats"}
    </Button>
  );
}
