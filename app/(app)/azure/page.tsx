import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Cloud, FolderTree, Globe, Layers } from "lucide-react";

import { Reveal } from "@/components/ui/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { buttonClass } from "@/components/ui/Button";
import { EstateSummaryCard } from "@/components/estate/EstateSummaryCard";
import {
  getAzureResources,
  getAzureAccount,
  getDriftedUrns,
  summarizeResourceGroups,
} from "./data";
import { AzureEstateExplorer } from "./explorer";

export const metadata: Metadata = { title: "Azure estate" };
export const dynamic = "force-dynamic";

export default async function AzurePage() {
  // Real discovered Azure resources from the `resources` table — never mocked.
  const [resources, account, drifted] = await Promise.all([
    getAzureResources(),
    getAzureAccount(),
    getDriftedUrns(),
  ]);

  const resourceGroups = summarizeResourceGroups(resources, drifted);
  const serviceCount = new Set(resources.map((r) => r.service)).size;
  const regionCount = new Set(resources.map((r) => r.region)).size;

  const stats = [
    { label: "Resources", value: resources.length, icon: <Boxes /> },
    { label: "Resource groups", value: resourceGroups.length, icon: <FolderTree /> },
    { label: "Services", value: serviceCount, icon: <Layers /> },
    { label: "Regions", value: regionCount, icon: <Globe /> },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-card"
            aria-hidden
          >
            <Cloud size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[24px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              Azure estate
            </h1>
            <p className="mt-1 truncate text-[14px] leading-[1.6] text-mute">
              {account.subscriptionId ? (
                <>
                  <span className="font-mono text-body">
                    {account.displayName ?? "Subscription"}
                  </span>{" "}
                  · <span className="font-mono">{account.subscriptionId}</span>
                </>
              ) : (
                "Azure subscription estate explorer — read-only."
              )}
            </p>
          </div>
        </header>
      </Reveal>

      {resources.length === 0 ? (
        <Reveal delay={0.08}>
          <EmptyState
            icon={<Cloud />}
            title="No Azure resources discovered yet"
            description="Argus hasn't mapped this subscription. Run the Azure sync to discover resource groups, services and resources read-only via Resource Graph — they'll appear here grouped by resource group and service."
            action={
              <Link href="/overview" className={buttonClass("install", "sm")}>
                Go to overview
              </Link>
            }
          />
        </Reveal>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={Math.min(i, 8) * 0.04}>
                <StatTile label={s.label} value={s.value} icon={s.icon} />
              </Reveal>
            ))}
          </div>

          <section aria-label="Resource groups" className="mb-8">
            <h2 className="mb-3 text-[11px] font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
              Resource groups
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {resourceGroups.map((summary, i) => (
                <Reveal key={summary.id} delay={Math.min(i, 8) * 0.04}>
                  <EstateSummaryCard
                    summary={summary}
                    href={`/azure/${encodeURIComponent(summary.id)}`}
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
              <AzureEstateExplorer resources={resources} />
            </Reveal>
          </section>
        </>
      )}
    </div>
  );
}
