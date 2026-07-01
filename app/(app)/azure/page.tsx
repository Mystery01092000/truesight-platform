import type { Metadata } from "next";
import { Cloud } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import {
  getAzureResources,
  getAzureAccount,
  groupByResourceGroup,
} from "./data";
import { AzureEstateExplorer } from "./explorer";

export const metadata: Metadata = { title: "Azure estate" };
export const dynamic = "force-dynamic";

export default async function AzurePage() {
  // Real discovered Azure resources from the `resources` table — never mocked.
  const [resources, account] = await Promise.all([getAzureResources(), getAzureAccount()]);

  const rgGroups = groupByResourceGroup(resources);
  const resourceGroups = rgGroups.map((g) => g.resourceGroup);
  const services = rgGroups.flatMap((g) => g.services);
  const serviceCount = new Set(resources.map((r) => r.service)).size;
  const regionCount = new Set(resources.map((r) => r.region)).size;

  const stats = [
    { label: "Resources", value: resources.length },
    { label: "Resource groups", value: resourceGroups.length },
    { label: "Services", value: serviceCount },
    { label: "Regions", value: regionCount },
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
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-lg border border-hairline bg-surface-card">
              <Cloud size={24} strokeWidth={1.5} className="text-mute" />
            </div>
            <h2 className="mt-4 text-[18px] font-medium leading-[1.4] text-ink">
              No Azure resources discovered yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
              Argus hasn&rsquo;t mapped this subscription. Run the Azure sync to discover
              resource groups, services and resources read-only via Resource Graph — they&rsquo;ll
              appear here grouped by resource group and service.
            </p>
          </Surface>
        </Reveal>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.05}>
                <Surface level={1} radius="lg" className="p-5">
                  <div className="text-[13px] text-mute">{s.label}</div>
                  <div className="mt-2 font-display text-[40px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
                    {s.value}
                  </div>
                </Surface>
              </Reveal>
            ))}
          </div>

          <AzureEstateExplorer resourceGroups={resourceGroups} services={services} />
        </>
      )}
    </div>
  );
}
