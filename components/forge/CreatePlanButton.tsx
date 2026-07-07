"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Inline create form — name in, POST, jump straight into the studio. */
export function CreatePlanButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forge/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await res.json()) as { success: boolean; data?: { id: string }; error?: string };
      if (!body.success || !body.data) {
        setError(body.error ?? "Failed to create the plan");
        return;
      }
      router.push(`/forge/${body.data.id}`);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <Plus size={16} strokeWidth={2} />
        New plan
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void create()}
          placeholder="Plan name…"
          className="h-9 w-52 rounded-md border border-hairline bg-surface-card px-3 text-[13px] text-ink outline-none placeholder:text-ash focus:border-iris"
        />
        <Button variant="primary" size="md" disabled={busy || !name.trim()} onClick={() => void create()}>
          Create
        </Button>
        <Button variant="tertiary" size="md" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-[12px] text-negative">{error}</p> : null}
    </div>
  );
}
