import type { Metadata } from "next";
import { GitBranch, FileCode2, Layers } from "lucide-react";

import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { listRecentPlans } from "@/lib/integrations/terraform/plans";
import type { TerraformPlan } from "@/db/schema";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlanTimeline, type PlanDay } from "./PlanTimeline";
import { RefreshPlansButton } from "./RefreshPlansButton";

export const metadata: Metadata = { title: "Terraform Executions" };
export const dynamic = "force-dynamic";

/** "prod-webapp.tfplan" in "plans/prod/webapp/" → "prod webapp (webapp · prod)".
 *  Mirrors the formatter in /api/terraform/plans so both surfaces read the same. */
function displayName(p: TerraformPlan): string {
  const base = (p.name ?? p.key)
    .replace(/\.(tfplan|tfstate)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const scope = [p.service, p.env].filter(Boolean).join(" · ");
  return scope ? `${base} (${scope})` : base;
}

function humanBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayLabel(date: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / DAY_MS);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function relativeLabel(date: Date, now: Date): string {
  const ms = now.getTime() - date.getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < DAY_MS) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / DAY_MS)}d ago`;
}

export default async function PlansPage() {
  const session = await getSession();
  const canRefresh = session ? can(session.role, "sync:trigger") : false;

  // Read the persisted table directly — the operator-gated API is only for the
  // explicit S3 refresh; viewing history is open to every authed role.
  const plans = await listRecentPlans();
  const now = new Date();

  const envs = new Set(plans.map((p) => p.env).filter((e): e is string => Boolean(e)));
  const latest = plans
    .map((p) => p.lastModified ?? p.discoveredAt)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  // Group newest-first by calendar day; all display strings are computed here
  // on the server so the client island never re-formats dates (no hydration
  // drift, no timezone split between server and client render).
  const days: PlanDay[] = [];
  for (const p of plans) {
    const when = p.lastModified ?? p.discoveredAt;
    const label = dayLabel(when, now);
    // Merge by label (not just the previous bucket): rows with a null
    // lastModified sort last but fall back to discoveredAt, which can repeat
    // an earlier day label — labels must stay unique (they key the sections).
    let bucket = days.find((d) => d.label === label);
    if (!bucket) {
      bucket = { label, entries: [] };
      days.push(bucket);
    }
    bucket.entries.push({
      id: p.id,
      displayName: displayName(p),
      env: p.env,
      service: p.service,
      sizeLabel: humanBytes(p.sizeBytes),
      timeLabel: timeLabel(when),
      key: p.key,
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Reveal>
        <PageHeader
          title="Terraform Executions"
          iconTone="iris"
          icon={<GitBranch size={22} strokeWidth={1.75} className="text-iris" />}
          description="Plan-execution history discovered from the Terraform state bucket — read-only, referenced never managed."
          actions={canRefresh ? <RefreshPlansButton /> : undefined}
        />
      </Reveal>

      {/* ── Stat row ───────────────────────────────────────────────────── */}
      <Reveal delay={0.05}>
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile
            label="Total plans"
            value={plans.length}
            icon={<FileCode2 strokeWidth={1.75} />}
          />
          <StatTile
            label="Environments covered"
            value={envs.size}
            icon={<Layers strokeWidth={1.75} />}
          />
          <div className="rounded-lg border border-hairline bg-surface p-4">
            <span className="text-label font-medium leading-[1.5] tracking-[0.015em] text-mute">
              Latest execution
            </span>
            <div className="mt-2 font-mono text-[28px] font-medium leading-none text-ink">
              {latest ? relativeLabel(latest, now) : "—"}
            </div>
            {latest && (
              <div className="mt-2 font-mono text-micro leading-[1.4] tracking-[0.06em] text-ash tabular-nums">
                {dayLabel(latest, now)} · {timeLabel(latest)}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* ── Chat-style execution timeline ──────────────────────────────── */}
      {plans.length === 0 ? (
        <Reveal delay={0.1}>
          <EmptyState
            icon={<GitBranch size={24} strokeWidth={1.5} />}
            title="Truesight hasn't discovered any plan executions yet"
            description="Plan artifacts are swept read-only from the Terraform state bucket. Refresh from S3 to run a discovery sweep."
            action={canRefresh ? <RefreshPlansButton /> : undefined}
          />
        </Reveal>
      ) : (
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-6">
            <PlanTimeline days={days} />
          </Surface>
        </Reveal>
      )}
    </div>
  );
}
