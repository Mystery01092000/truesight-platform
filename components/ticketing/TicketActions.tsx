"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { ApprovalDecision } from "@/lib/ticketing/types";

/**
 * TicketActions — client-side action bar for a ticket detail view. Drives the
 * approval decision endpoints (approve / need-more-info / decline) and, for
 * DevOps, the complete endpoint.
 */
export function TicketActions({
  ticketId,
  canApprove,
  isAdmin,
  status,
}: {
  ticketId: string;
  canApprove: boolean;
  isAdmin: boolean;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function postDecision(decision: ApprovalDecision) {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? data?.error ?? "Action failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function markDone() {
    setBusy("done");
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? data?.error ?? "Action failed.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <p className="mr-auto text-[12px] text-accent-red">{error}</p>
      )}
      {canApprove && (
        <>
          <Button
            variant="primary"
            size="sm"
            disabled={busy !== null}
            onClick={() => postDecision("approved")}
          >
            {busy === "approved" ? "Approving…" : "Approve"}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            disabled={busy !== null}
            onClick={() => postDecision("need_more_info")}
          >
            Need more info
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => postDecision("declined")}
          >
            Decline
          </Button>
        </>
      )}
      {isAdmin && status === "approved" && (
        <Button variant="primary" size="sm" disabled={busy !== null} onClick={markDone}>
          {busy === "done" ? "Completing…" : "Mark as Done"}
        </Button>
      )}
      {!canApprove && !(isAdmin && status === "approved") && (
        <p className="text-[13px] text-mute">No actions available for this ticket right now.</p>
      )}
    </div>
  );
}
