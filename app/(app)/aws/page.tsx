import type { Metadata } from "next";
import Link from "next/link";
import { Cloud } from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { EstateSummaryCard } from "@/components/estate/EstateSummaryCard";
import { ResourceExplorer } from "@/components/estate/ResourceExplorer";
import { getAwsEstateResources, getDriftedUrns, summarizeAccounts } from "./data";

export const metadata: Metadata = { title: "AWS estate" };
export const dynamic = "force-dynamic";

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AwsPage() {
  // Real discovered AWS resources from the `resources` table — never mocked.
  const [resources, drifted] = await Promise.all([getAwsEstateResources(), getDriftedUrns()]);
  const accounts = summarizeAccounts(resources, drifted);
  const serviceCount = new Set(resources.map((r) => r.service)).size;

  const countLine = `${plural(resources.length, "resource")} · ${plural(
    accounts.length,
    "account",
  )} · ${plural(serviceCount, "service")}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-card"
            aria-hidden
          >
            <Cloud size={22} strokeWidth={1.75} className="text-accent-blue" />
          </span>
          <div>
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              AWS estate
            </h1>
            <p className="mt-1 text-[14px] leading-[1.6] text-mute tabular-nums">
              {resources.length > 0
                ? countLine
                : "Multi-account AWS estate explorer — read-only."}
            </p>
          </div>
        </header>
      </Reveal>

      {resources.length === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Cloud />}
            title="No AWS resources discovered yet"
            description="Argus hasn't mapped this estate. Trigger a sync to discover accounts, services and resources read-only — they'll appear here grouped by account and service."
            action={
              <Link href="/overview" className={buttonClass("install", "sm")}>
                Go to overview
              </Link>
            }
          />
        </Reveal>
      ) : (
        <>
          <section aria-label="Accounts" className="mb-8">
            <h2 className="mb-3 text-[11px] font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
              Accounts
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map((summary, i) => (
                <Reveal key={summary.id} delay={Math.min(i, 8) * 0.04}>
                  <EstateSummaryCard
                    summary={summary}
                    href={`/aws/${encodeURIComponent(summary.id)}`}
                  />
                </Reveal>
              ))}
            </div>
          </section>

          <section aria-label="Resources">
            <h2 className="mb-3 text-[11px] font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
              Resources
            </h2>
            <Reveal delay={0.08}>
              <ResourceExplorer
                resources={resources}
                provider="aws"
                groupColumn={{ header: "Account", hrefBase: "/aws" }}
                storageKey="argus:aws:estate"
              />
            </Reveal>
          </section>
        </>
      )}
    </div>
  );
}
