"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PillTabs } from "@/components/ui/PillTabs";
import { TextInput } from "@/components/ui/TextInput";
import { ROLES, type Role } from "@/lib/auth/rbac";

/**
 * PlatformAdminsCard — the allowlist console. Rows arrive server-serialized;
 * add/remove go through /api/settings/admins and re-stream the RSC screen via
 * router.refresh() so the table is always the database's truth.
 */
export type AdminRow = {
  id: string;
  email: string;
  role: string;
  note: string | null;
  createdLabel: string;
};

export function PlatformAdminsCard({ admins }: { admins: AdminRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const needle = email.trim().toLowerCase();
    if (!needle || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: needle, role, note: note.trim() || undefined }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `Save failed (${res.status})`);
      setEmail("");
      setNote("");
      setRole("viewer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (target: string) => {
    if (removing) return;
    setRemoving(target);
    setError(null);
    try {
      const res = await fetch(`/api/settings/admins?email=${encodeURIComponent(target)}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `Remove failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setRemoving(null);
    }
  };

  const columns = useMemo<ColumnDef<AdminRow>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="font-mono text-[13px] leading-[1.5] text-body">
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <Badge>{row.original.role}</Badge>,
      },
      {
        accessorKey: "note",
        header: "Note",
        cell: ({ row }) => (
          <span className="text-[13px] leading-[1.5] text-mute">{row.original.note ?? "—"}</span>
        ),
      },
      {
        accessorKey: "createdLabel",
        header: "Added",
        cell: ({ row }) => (
          <span className="font-mono text-[11px] leading-[1.4] text-ash tabular-nums">
            {row.original.createdLabel}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => remove(row.original.email)}
            disabled={removing !== null}
            aria-label={`Remove ${row.original.email}`}
          >
            <Trash2 size={13} aria-hidden />
            {removing === row.original.email ? "Removing…" : "Remove"}
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removing],
  );

  return (
    <div>
      <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
        Platform admins
      </h2>
      <p className="mt-1 text-[13px] leading-[1.5] text-mute">
        Emails on this allowlist are granted the mapped role at login. The last remaining admin
        can never be removed.
      </p>

      <div className="mt-4">
        <DataTable columns={columns} data={admins} emptyMessage="No allowlist entries yet." />
      </div>

      {/* ── Add-by-email form ──────────────────────────────────────────── */}
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-3">
        <div className="w-64 min-w-48 flex-1 sm:flex-none">
          <TextInput
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@centricity.co.in"
            aria-label="Email to add"
            icon={<Mail />}
            className="text-[14px]"
          />
        </div>
        <PillTabs
          aria-label="Role for new entry"
          value={role}
          onChange={(v) => setRole(v as Role)}
          items={ROLES.map((r) => ({ value: r, label: r }))}
        />
        <div className="w-48 min-w-40 flex-1 sm:flex-none">
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Note"
            className="text-[14px]"
          />
        </div>
        <Button type="submit" variant="install" size="sm" disabled={busy || !email.trim()}>
          <Plus size={14} aria-hidden />
          {busy ? "Adding…" : "Add"}
        </Button>
      </form>

      <p role="alert" aria-live="polite" className="mt-2 min-h-4 text-[11px] leading-[1.4] text-critical">
        {error}
      </p>
    </div>
  );
}
