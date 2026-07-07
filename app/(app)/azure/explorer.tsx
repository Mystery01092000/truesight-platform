"use client";

import { useMemo } from "react";

import { ResourceExplorer } from "@/components/estate/ResourceExplorer";
import type { EstateResource } from "@/components/estate/types";
import type { AzureResource } from "./data";

/**
 * Azure explorer wrappers — normalize AzureResource rows into the shared
 * EstateResource shape (the resource group is Azure's grouping dimension, so
 * it rides in `account`) and hand off to the shared ResourceExplorer.
 *
 * The legacy data estate (SQL servers/databases, managed instances,
 * Databricks, Data Factory) surfaces through the taxonomy-driven service
 * labels + the "Data platform" section that ResourceExplorer renders for
 * provider="azure" (see azureServiceLabel / isDataPlatformService in
 * components/estate/types.ts).
 */
function toEstateResource(r: AzureResource): EstateResource {
  return {
    urn: r.urn,
    name: r.name,
    account: r.resourceGroup,
    region: r.region,
    service: r.service,
    kind: r.kind,
    status: r.status,
    lastSeen: r.lastSeen,
    nativeType: r.nativeType,
    environment: r.environment,
    tags: r.tags,
  };
}

/** Consolidated /azure explorer — all resource groups, with an RG column. */
export function AzureEstateExplorer({ resources }: { resources: AzureResource[] }) {
  const rows = useMemo(() => resources.map(toEstateResource), [resources]);
  return (
    <ResourceExplorer
      resources={rows}
      provider="azure"
      groupColumn={{ header: "Resource group", hrefBase: "/azure" }}
      storageKey="truesight:azure:estate"
    />
  );
}

/** Resource-group drill-down explorer — already scoped, no RG column. */
export function AzureResourceTable({
  resources,
  storageKey = "truesight:azure:rg",
}: {
  resources: AzureResource[];
  /** Per-resource-group namespace so persisted facets don't leak across RGs. */
  storageKey?: string;
}) {
  const rows = useMemo(() => resources.map(toEstateResource), [resources]);
  return <ResourceExplorer resources={rows} provider="azure" storageKey={storageKey} />;
}
