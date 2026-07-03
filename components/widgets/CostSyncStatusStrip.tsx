import { cn } from "@/lib/utils/cn";
import { formatRelative } from "@/lib/utils/format";
import type { CostSyncProviderStatus } from "@/app/(app)/cost/data";

/**
 * CostSyncStatusStrip — one quiet row above the cost console stating, per
 * provider, when spend was last pulled and whether it succeeded. Failures
 * surface the first recorded error verbatim (truncated; hover lists every
 * failed scope) so an operator knows exactly what to fix. Never fabricates
 * a sync.
 */
const PROVIDER_LABEL: Record<CostSyncProviderStatus["provider"], string> = {
  aws: "AWS",
  azure: "Azure",
};

const DOT: Record<CostSyncProviderStatus["status"], string> = {
  ok: "bg-accent-green",
  partial: "bg-accent-yellow",
  error: "bg-accent-red",
  never: "bg-stone",
};

function statusLine(entry: CostSyncProviderStatus): string {
  const firstError = entry.errors[0]?.message;
  const rest = entry.errors.length > 1 ? ` +${entry.errors.length - 1} more` : "";
  switch (entry.status) {
    case "ok":
      return entry.finishedAt ? `synced ${formatRelative(entry.finishedAt)}` : "synced";
    case "partial":
      return firstError ? `partial — ${firstError}${rest}` : "partial sync";
    case "error":
      return firstError ? `failed — ${firstError}${rest}` : "failed";
    case "never":
      return "never synced";
  }
}

/** Hover reveals every failed scope, not just the first truncated one. */
function statusTitle(entry: CostSyncProviderStatus, line: string): string {
  const head = `${PROVIDER_LABEL[entry.provider]} · ${line}`;
  if (entry.errors.length <= 1) return head;
  return `${head}\n${entry.errors.map((e) => `${e.scope}: ${e.message}`).join("\n")}`;
}

export function CostSyncStatusStrip({ entries }: { entries: CostSyncProviderStatus[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {entries.map((entry) => {
        const line = statusLine(entry);
        return (
          <span
            key={entry.provider}
            className="flex min-w-0 items-center gap-1.5 text-micro text-mute"
            title={statusTitle(entry, line)}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", DOT[entry.status])} aria-hidden />
            <span className="shrink-0 font-medium text-body">{PROVIDER_LABEL[entry.provider]}</span>
            <span className="shrink-0 text-ash" aria-hidden>
              ·
            </span>
            <span className="max-w-[48ch] truncate">{line}</span>
          </span>
        );
      })}
    </div>
  );
}
