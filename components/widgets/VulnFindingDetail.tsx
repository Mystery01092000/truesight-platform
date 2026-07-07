"use client";

import Link from "next/link";
import { Boxes, ExternalLink, Wrench } from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Surface } from "@/components/ui/Surface";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import type { Severity } from "@/lib/taxonomy";

/**
 * VulnFindingDetail — the Drawer body for a single vulnerability finding from
 * the durable `vulnerability_findings` table (JSON-serialized over
 * /api/vulnerabilities, so timestamps arrive as ISO strings). Layout: badge
 * strip → title → meta grid (package / CVE / seen window / URN) → description →
 * the proposed mitigation, promoted onto an elevated surface → resource links
 * (external console link, NVD, and the derived Truesight inventory route).
 */
export type VulnFinding = {
  id: string;
  urn: string | null;
  source: string;
  externalId: string;
  severity: Severity | null;
  title: string | null;
  description: string | null;
  mitigation: string | null;
  packageName: string | null;
  cve: string | null;
  resourceLink: string | null;
  status: string;
  firstSeen: string;
  lastSeen: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Derive the Truesight inventory route from a canonical URN
 * (`provider:account:region:service:nativeId`). AWS drills into the account
 * explorer; Azure lands on the estate explorer. Anything else (github,
 * terraform, malformed) returns null and the external resourceLink carries.
 */
export function vulnInventoryHref(urn: string | null): string | null {
  if (!urn) return null;
  const [provider, account] = urn.split(":");
  if (provider === "aws" && account) return `/aws/${encodeURIComponent(account)}`;
  if (provider === "azure") return "/azure";
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Meta({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
        {label}
      </dt>
      <dd className="mt-1 text-label leading-[1.6] text-body">{children}</dd>
    </div>
  );
}

export function VulnFindingDetail({
  finding,
  className,
}: {
  finding: VulnFinding;
  className?: string;
}) {
  const inventoryHref = vulnInventoryHref(finding.urn);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={finding.severity ?? "info"} />
          <Badge>{capitalize(finding.status)}</Badge>
          <Badge className="font-mono">{finding.source}</Badge>
        </div>
        <h3 className="mt-3 text-[16px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
          {finding.title ?? "Untitled finding"}
        </h3>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {finding.packageName ? (
          <Meta label="Package">
            <span className="break-all font-mono text-label text-ink">{finding.packageName}</span>
          </Meta>
        ) : null}
        {finding.cve ? (
          <Meta label="CVE">
            <a
              href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(finding.cve)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-label text-iris transition-colors duration-150 ease-smooth hover:text-on-dark"
            >
              {finding.cve}
              <ExternalLink size={11} strokeWidth={1.75} aria-hidden />
            </a>
          </Meta>
        ) : null}
        <Meta label="First seen">{formatDate(finding.firstSeen)}</Meta>
        <Meta label="Last seen">{formatDate(finding.lastSeen)}</Meta>
        {finding.urn ? (
          <Meta label="Resource URN" className="col-span-2">
            <span className="break-all font-mono text-[12px] text-mute">{finding.urn}</span>
          </Meta>
        ) : null}
      </dl>

      {finding.description ? (
        <section>
          <h4 className="text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
            Description
          </h4>
          <p className="mt-1.5 whitespace-pre-line text-label leading-[1.6] text-body">
            {finding.description}
          </p>
        </section>
      ) : null}

      {finding.mitigation ? (
        <Surface level={2} radius="md" className="p-4">
          <div className="flex items-center gap-1.5 text-micro font-medium uppercase leading-[1.4] tracking-[0.06em] text-ash">
            <Wrench size={12} strokeWidth={1.75} aria-hidden />
            Proposed mitigation
          </div>
          <p className="mt-2 whitespace-pre-line text-[14px] leading-[1.7] text-ink">
            {finding.mitigation}
          </p>
        </Surface>
      ) : null}

      {finding.resourceLink || inventoryHref ? (
        <div className="flex flex-wrap items-center gap-2">
          {finding.resourceLink ? (
            <a
              href={finding.resourceLink}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass("install", "sm")}
            >
              <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
              View resource
            </a>
          ) : null}
          {inventoryHref ? (
            <Link href={inventoryHref} className={buttonClass("tertiary", "sm")}>
              <Boxes size={13} strokeWidth={1.75} aria-hidden />
              Open in inventory
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
