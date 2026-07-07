import type { Metadata } from "next";
import Link from "next/link";
import { Cloud } from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
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
        <PageHeader
          title="AWS estate"
          icon={<Cloud size={22} strokeWidth={1.75} className="text-accent-blue" />}
          description={
            <span className="tabular-nums">
              {resources.length > 0 ? countLine : "Multi-account AWS estate explorer — read-only."}
            </span>
          }
        />
      </Reveal>

      {resources.length === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Cloud />}
            title="No AWS resources discovered yet"
            description="Truesight hasn't mapped this estate. Trigger a sync to discover accounts, services and resources read-only — they'll appear here grouped by account and service."
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
            <h2 className="mb-3 text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
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
            <h2 className="mb-3 text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
              Resources
            </h2>
            <Reveal delay={0.08}>
              <ResourceExplorer
                resources={resources}
                provider="aws"
                groupColumn={{ header: "Account", hrefBase: "/aws" }}
                storageKey="truesight:aws:estate"
              />
            </Reveal>
          </section>
        </>
      )}
    </div>
  );
}
