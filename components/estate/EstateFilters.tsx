"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import { PillTabs, type PillTabItem } from "@/components/ui/PillTabs";
import { Reveal } from "@/components/ui/Reveal";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { ServiceGroup } from "@/components/estate/ServiceGroup";
import type { ServiceGroupData } from "@/components/estate/types";

const ALL = "all";

/**
 * EstateFilters — the client shell for the AWS explorer. Holds the account /
 * service selection (persisted cross-session via usePersistedState), renders the
 * PillTabs, and paints the filtered responsive grid of ServiceGroup cards with a
 * staggered Reveal that re-runs whenever the filter changes.
 */
export function EstateFilters({
  accounts,
  services,
}: {
  accounts: string[];
  services: ServiceGroupData[];
}) {
  const [account, setAccount] = usePersistedState<string>("argus.aws.account", ALL);
  const [service, setService] = usePersistedState<string>("argus.aws.service", ALL);

  const byAccount = useMemo(
    () => (account === ALL ? services : services.filter((g) => g.account === account)),
    [services, account],
  );

  const serviceNames = useMemo(
    () => [...new Set(byAccount.map((g) => g.service))].sort(),
    [byAccount],
  );

  // A service selection only holds while it exists in the active account scope.
  const activeService = serviceNames.includes(service) ? service : ALL;

  const visible = useMemo(
    () => (activeService === ALL ? byAccount : byAccount.filter((g) => g.service === activeService)),
    [byAccount, activeService],
  );

  const accountItems: PillTabItem[] = [
    { value: ALL, label: "All accounts" },
    ...accounts.map((a) => ({ value: a, label: a })),
  ];
  const serviceItems: PillTabItem[] = [
    { value: ALL, label: "All services" },
    ...serviceNames.map((s) => ({ value: s, label: s })),
  ];

  const shownResources = visible.reduce((n, g) => n + g.count, 0);

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 border-b border-hairline pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PillTabs
            aria-label="Filter by account"
            value={account}
            onChange={setAccount}
            items={accountItems}
          />
          <span className="text-[12px] tabular-nums text-mute">
            {visible.length} {visible.length === 1 ? "service" : "services"} ·{" "}
            {shownResources} {shownResources === 1 ? "resource" : "resources"}
          </span>
        </div>
        {serviceItems.length > 1 && (
          <div className="-mb-1 flex flex-wrap gap-1 overflow-x-auto">
            <PillTabs
              aria-label="Filter by service"
              value={activeService}
              onChange={setService}
              items={serviceItems}
            />
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-[14px] leading-[1.6] text-mute">
          No resources match this filter.
        </p>
      ) : (
        <div
          key={`${account}:${activeService}`}
          className={cn("grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3")}
        >
          {visible.map((group, i) => (
            <Reveal key={`${group.account}:${group.service}`} delay={Math.min(i, 8) * 0.05}>
              <ServiceGroup group={group} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
