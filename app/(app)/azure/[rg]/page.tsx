import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cloud } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { getAzureResources } from "../data";
import { AzureResourceTable } from "../explorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rg: string }>;
}): Promise<Metadata> {
  const { rg } = await params;
  return { title: `Azure · ${decodeURIComponent(rg)}` };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AzureResourceGroupPage({
  params,
}: {
  params: Promise<{ rg: string }>;
}) {
  const { rg } = await params;
  const resourceGroup = decodeURIComponent(rg);

  // Real rows for this one resource group (never mocked).
  const resources = await getAzureResources(resourceGroup);
  const regionCount = new Set(resources.map((r) => r.region)).size;
  const serviceCount = new Set(resources.map((r) => r.service)).size;
  const subscriptionId = resources[0]?.subscriptionId ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <Reveal>
        <div className="mb-5">
          <Link
            href="/azure"
            className="inline-flex items-center gap-1.5 text-[13px] leading-[1.6] text-mute transition-colors hover:text-body"
          >
            <ArrowLeft size={14} />
            Azure estate
          </Link>
        </div>
        <header className="mb-8 flex items-start gap-3.5">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-lg border border-hairline bg-surface-card"
            aria-hidden
          >
            <Cloud size={22} strokeWidth={1.75} className="text-iris" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-mono text-[22px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
              {resourceGroup}
            </h1>
            <p className="mt-1 truncate text-[14px] leading-[1.6] text-mute">
              {resources.length > 0 ? (
                <>
                  {plural(resources.length, "resource")} · {plural(serviceCount, "service")} ·{" "}
                  {plural(regionCount, "region")}
                  {subscriptionId ? (
                    <>
                      {" "}
                      · <span className="font-mono">{subscriptionId}</span>
                    </>
                  ) : null}
                </>
              ) : (
                "Azure resource group"
              )}
            </p>
          </div>
        </header>
      </Reveal>

      {resources.length === 0 ? (
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-8 text-center">
            <h2 className="text-[18px] font-medium leading-[1.4] text-ink">
              No resources for this resource group
            </h2>
            <p className="mx-auto mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
              Nothing discovered under{" "}
              <span className="font-mono text-on-dark">{resourceGroup}</span> yet. Run the Azure
              sync, or head back to the estate overview.
            </p>
          </Surface>
        </Reveal>
      ) : (
        <Reveal delay={0.1}>
          <AzureResourceTable resources={resources} />
        </Reveal>
      )}
    </div>
  );
}
