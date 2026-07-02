"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * RefreshPlansButton — operator+ action that triggers the read-only S3 sweep
 * (`GET /api/terraform/plans?refresh=1`) and then re-streams the RSC screen.
 * The server page only renders this when `can(role, "sync:trigger")`.
 */
export function RefreshPlansButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/terraform/plans?refresh=1");
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `Refresh failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="install" size="sm" onClick={refresh} disabled={busy}>
        <RefreshCw size={14} className={cn(busy && "animate-spin")} aria-hidden />
        {busy ? "Sweeping bucket…" : "Refresh from S3"}
      </Button>
      <span role="alert" aria-live="polite" className="text-[11px] leading-[1.4] text-critical">
        {error}
      </span>
    </div>
  );
}
