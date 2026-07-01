import type { Metadata } from "next";
import { Cloud } from "lucide-react";
import { getAwsResources, groupByAccount } from "@/lib/estate/query";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { EstateFilters } from "@/components/estate/EstateFilters";

export const metadata: Metadata = { title: "AWS estate" };
export const dynamic = "force-dynamic";

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AwsPage() {
  // Real discovered AWS resources from the `resources` table — never mocked.
  const resources = await getAwsResources();
  const accountGroups = groupByAccount(resources);

  // Flatten to per-(account, service) groups so account filtering & drill-down
  // links stay accurate even when one service spans multiple accounts.
  const services = accountGroups.flatMap((a) => a.services);
  const accounts = accountGroups.map((a) => a.account);
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
        <Reveal delay={0.1}>
          <Surface level={1} radius="lg" className="p-8 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-lg border border-hairline bg-surface-card">
              <Cloud size={24} strokeWidth={1.5} className="text-mute" />
            </div>
            <h2 className="mt-4 text-[18px] font-medium leading-[1.4] text-ink">
              No AWS resources discovered yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-prose text-[14px] leading-[1.6] text-body">
              Argus hasn&rsquo;t mapped this estate. Trigger a sync to discover accounts,
              services and resources read-only — they&rsquo;ll appear here grouped by account
              and service.
            </p>
          </Surface>
        </Reveal>
      ) : (
        <EstateFilters accounts={accounts} services={services} />
      )}
    </div>
  );
}
