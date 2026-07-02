"use client";

import { useMemo, useState } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { PillTabs } from "@/components/ui/PillTabs";
import { FindingCard } from "@/components/widgets/FindingCard";
import type { FindingView } from "./page";
import type { CloudProvider, Severity } from "@/lib/taxonomy";

/**
 * SecurityFindingsView — the interactive findings list. Two PillTabs rows
 * (severity + provider) filter the server-fetched findings client-side so the
 * page stays a force-dynamic server component with no per-filter round-trips.
 */
export function SecurityFindingsView({ findings }: { findings: FindingView[] }) {
  const [severity, setSeverity] = useState<string>("all");
  const [provider, setProvider] = useState<string>("all");

  const providers = useMemo(() => {
    const set = new Set<CloudProvider>();
    for (const f of findings) if (f.provider) set.add(f.provider);
    return [...set];
  }, [findings]);

  const severityItems = useMemo(
    () => [
      { value: "all", label: "All" },
      ...(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => ({
        value: s,
        label: s.charAt(0).toUpperCase() + s.slice(1),
      })),
    ],
    [],
  );

  const providerItems = useMemo(
    () => [
      { value: "all", label: "All providers" },
      ...providers.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
    ],
    [providers],
  );

  const filtered = useMemo(
    () =>
      findings.filter(
        (f) =>
          (severity === "all" || f.severity === severity) &&
          (provider === "all" || f.provider === provider),
      ),
    [findings, severity, provider],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <PillTabs
          aria-label="Filter by severity"
          value={severity}
          onChange={setSeverity}
          items={severityItems}
        />
        {providers.length > 1 ? (
          <PillTabs
            aria-label="Filter by provider"
            value={provider}
            onChange={setProvider}
            items={providerItems}
          />
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-mute">
          No findings match this filter.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((f, i) => (
            <Reveal key={f.id} delay={Math.min(i * 0.03, 0.4)}>
              <FindingCard
                title={f.title ?? "Untitled finding"}
                severity={f.severity ?? "info"}
                provider={f.provider}
                resourceLink={f.details?.resourceLink}
                description={f.details?.description}
                remediation={f.details?.remediation}
              />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
