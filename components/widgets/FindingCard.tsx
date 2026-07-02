"use client";

import { ExternalLink, Wrench } from "lucide-react";
import { Surface } from "@/components/ui/Surface";
import { StatusBadge } from "@/components/ui/Badge";
import { ProviderChip } from "@/components/ui/ProviderChip";
import { cn } from "@/lib/utils/cn";
import type { Severity } from "@/lib/taxonomy";
import type { CloudProvider } from "@/lib/taxonomy";

/**
 * FindingCard — a single security finding rendered as a level-1 surface card.
 * Layout: severity StatusBadge + optional provider chip, then the title; followed
 * by the description, the proposed mitigation plan, and an external resource link.
 */
export type FindingCardProps = {
  title: string;
  severity: Severity;
  resourceLink?: string | null;
  description?: string | null;
  remediation?: string | null;
  provider?: CloudProvider | null;
  className?: string;
};

export function FindingCard({
  title,
  severity,
  resourceLink,
  description,
  remediation,
  provider,
  className,
}: FindingCardProps) {
  return (
    <Surface level={1} radius="lg" className={cn("flex h-full flex-col p-5", className)}>
      <div className="flex items-center gap-2">
        <StatusBadge status={severity} />
        {provider ? <ProviderChip provider={provider} /> : null}
      </div>

      <h3 className="mt-3 text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
        {title}
      </h3>

      {description ? (
        <p className="mt-2 text-[13px] leading-[1.6] text-body">{description}</p>
      ) : null}

      {remediation ? (
        <div className="mt-3 rounded-md border border-hairline bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.6px] text-ash">
            <Wrench size={12} strokeWidth={1.75} aria-hidden />
            Proposed mitigation
          </div>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-body">{remediation}</p>
        </div>
      ) : null}

      {resourceLink ? (
        <a
          href={resourceLink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-iris transition-colors hover:text-on-dark"
        >
          <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
          View resource
        </a>
      ) : null}
    </Surface>
  );
}
