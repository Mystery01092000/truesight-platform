import type { TokenCredential } from "@azure/identity";
import type { ResourceGraphClient } from "@azure/arm-resourcegraph";

import { mapAzureType } from "@/lib/taxonomy/azure";
import type { ResourceStatus } from "@/lib/taxonomy";
import { normalizeEnvironment } from "@/lib/taxonomy";
import type {
  AdapterError,
  AdapterHealth,
  CloudResource,
  DiscoveryResult,
  GraphEdge,
  IntegrationAdapter,
} from "@/lib/integrations/types";
import { makeUrn } from "@/lib/integrations/types";

import { createResourceGraphClient, resolveSubscription } from "./client";

/* -------------------------------------------------------------------------- */
/* Public factory                                                             */
/* -------------------------------------------------------------------------- */

export interface AzureAdapterConfig {
  /** Pre-resolved subscription id (the natural identity of an Azure integration). */
  subscriptionId: string;
  /** Display name matched against AZURE_SUBSCRIPTION_NAME (used by healthCheck). */
  subscriptionName: string;
  /** Friendly display name persisted by the orchestrator. */
  label: string;
  /** Read-only Service Principal credential. */
  credential: TokenCredential;
  /** Optional focus resource group (UI hint only; discovery is subscription-wide). */
  resourceGroup?: string;
}

/**
 * A read-only Azure integration adapter. `instanceId` / `accountId` is the
 * subscription id (the natural identity of an Azure integration, mirroring how
 * the AWS adapter keys on account id); `label` is the subscription display name.
 */
export interface AzureIntegrationAdapter extends IntegrationAdapter {
  readonly accountId: string;
  readonly label: string;
  readonly subscriptionName: string;
}

/**
 * Single Resource Graph KQL inventory over one subscription. Projects the
 * canonical facets plus `properties` so we can both enrich attributes and
 * derive the network topology edges (vnet→subnet, NIC/VM→vnet) that are only
 * inferable from resource properties.
 */
const KQL =
  "Resources | project id, name, type, location, resourceGroup, subscriptionId, tags, sku, kind, properties";

/**
 * Legacy data-estate types (SQL servers/databases/managed instances, Databricks,
 * Data Factory) pulled through a second, explicit KQL scope so they are always
 * present even when the broad inventory pull partially fails. Rows returned by
 * both scopes dedupe by ARM id before graph construction.
 */
const LEGACY_ESTATE_TYPES = [
  "microsoft.sql/servers",
  "microsoft.sql/servers/databases",
  "microsoft.sql/managedinstances",
  "microsoft.databricks/workspaces",
  "microsoft.datafactory/factories",
] as const;

const LEGACY_KQL = `Resources | where type in~ (${LEGACY_ESTATE_TYPES.map((t) => `'${t}'`).join(", ")}) | project id, name, type, location, resourceGroup, subscriptionId, tags, sku, kind, properties`;

export function createAzureAdapter(cfg: AzureAdapterConfig): AzureIntegrationAdapter {
  const { subscriptionId, subscriptionName, label, credential, resourceGroup } = cfg;

  return {
    provider: "azure",
    instanceId: subscriptionId,
    accountId: subscriptionId,
    label,
    subscriptionName,

    async healthCheck(): Promise<AdapterHealth> {
      try {
        const sub = await resolveSubscription(credential, subscriptionName);
        return {
          provider: "azure",
          instanceId: subscriptionId,
          ok: true,
          detail: `sub=${sub.subscriptionId} name=${sub.displayName} state=${sub.state ?? "?"}`,
        };
      } catch (err) {
        const e = toAdapterError("subscriptions:list", err);
        return {
          provider: "azure",
          instanceId: subscriptionId,
          ok: false,
          detail: `${e.code}: ${e.message}`,
        };
      }
    },

    async discover(): Promise<DiscoveryResult> {
      const client = createResourceGraphClient(credential);
      const errors: AdapterError[] = [];

      // Two logical scopes (broad inventory + explicit legacy data estate), each
      // a paged Resource Graph pull. Wrapped in Promise.allSettled so a failure
      // yields a partial result instead of throwing.
      const scopes: Array<[string, () => Promise<AzureRow[]>]> = [
        [`resourcegraph:${subscriptionId}`, () => queryAllRows(client, subscriptionId, KQL)],
        [
          `resourcegraph:legacy:${subscriptionId}`,
          () => queryAllRows(client, subscriptionId, LEGACY_KQL),
        ],
      ];
      const settled = await Promise.allSettled(scopes.map(([, fn]) => fn()));

      // Merge scopes, deduping by ARM id (legacy rows overlap the broad pull).
      const rows: AzureRow[] = [];
      const seenIds = new Set<string>();
      settled.forEach((res, i) => {
        if (res.status === "fulfilled") {
          for (const row of res.value) {
            const key = row.id.toLowerCase();
            if (seenIds.has(key)) continue;
            seenIds.add(key);
            rows.push(row);
          }
        } else {
          errors.push(toAdapterError(scopes[i][0], res.reason));
        }
      });

      const { resources, edges } = buildGraph(rows, subscriptionId);
      void resourceGroup; // focus hint is surfaced in the UI, not used to filter discovery.

      return {
        resources,
        edges,
        partial: errors.length > 0,
        errors,
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Resource Graph query (paged)                                               */
/* -------------------------------------------------------------------------- */

interface AzureRow {
  id: string;
  name?: string;
  type: string;
  location?: string;
  resourceGroup?: string;
  subscriptionId?: string;
  tags?: Record<string, unknown> | null;
  sku?: unknown;
  kind?: string | null;
  properties?: Record<string, unknown> | null;
}

async function queryAllRows(
  client: ResourceGraphClient,
  subscriptionId: string,
  query: string,
): Promise<AzureRow[]> {
  const out: AzureRow[] = [];
  let skipToken: string | undefined;

  do {
    const resp = await client.resources({
      subscriptions: [subscriptionId],
      query,
      options: { resultFormat: "objectArray", top: 1000, skipToken },
    });
    const data = resp.data;
    if (Array.isArray(data)) {
      for (const row of data as AzureRow[]) {
        if (row && typeof row.id === "string" && row.id) out.push(row);
      }
    }
    skipToken = resp.skipToken;
  } while (skipToken);

  return out;
}

/* -------------------------------------------------------------------------- */
/* Graph construction (resources + edges)                                     */
/* -------------------------------------------------------------------------- */

function buildGraph(rows: AzureRow[], subId: string): { resources: CloudResource[]; edges: GraphEdge[] } {
  const resById = new Map<string, CloudResource>();
  const urnById = new Map<string, string>(); // lowercased ARM id -> urn
  const edgeMap = new Map<string, GraphEdge>();

  const addResource = (r: CloudResource, armId: string) => {
    if (!resById.has(r.urn)) {
      resById.set(r.urn, r);
      urnById.set(armId.toLowerCase(), r.urn);
    }
  };
  const addEdge = (e: GraphEdge) => {
    if (e.source === e.target) return;
    const k = `${e.source}|${e.target}|${e.kind}`;
    if (!edgeMap.has(k)) edgeMap.set(k, { ...e, id: k });
  };

  // 1. Top-level resources from the inventory.
  for (const row of rows) {
    addResource(toResource(row, subId), row.id);
  }

  // 2. Synthesize resource-group container nodes (real Azure constructs).
  const rgNames = new Set<string>();
  for (const row of rows) {
    if (row.resourceGroup) rgNames.add(row.resourceGroup);
  }
  for (const rg of rgNames) {
    const rgRes = rgResource(rg, subId);
    addResource(rgRes, rgResourceId(rg, subId));
  }

  // 3. Synthesize subnet nodes from vnet properties (subnets are not top-level
  //    rows in the Resources table — they live under the vnet's properties).
  for (const row of rows) {
    if (row.type?.toLowerCase() !== "microsoft.network/virtualnetworks") continue;
    for (const sn of asArray(row.properties?.subnets)) {
      const snId = str(sn?.id);
      if (!snId) continue;
      addResource(subnetResource(sn, row, subId), snId);
    }
  }

  // Precompute NIC -> vnet mapping for VM edges.
  const nicToVnetUrn = new Map<string, string>();
  for (const row of rows) {
    if (row.type?.toLowerCase() !== "microsoft.network/networkinterfaces") continue;
    for (const vnetId of nicVnetIds(row.properties)) {
      const vnetUrn = urnById.get(vnetId.toLowerCase());
      if (vnetUrn) nicToVnetUrn.set(row.id.toLowerCase(), vnetUrn);
    }
  }

  // 4. Edges.
  for (const row of rows) {
    const selfUrn = urnById.get(row.id.toLowerCase());
    if (!selfUrn) continue;
    const ntl = (row.type ?? "").toLowerCase();
    const props = row.properties ?? {};

    // resource -> resource group (contained-by)
    if (row.resourceGroup) {
      const rgUrn = urnById.get(rgResourceId(row.resourceGroup, subId).toLowerCase());
      if (rgUrn) addEdge(edge(selfUrn, rgUrn, "contains"));
    }

    // vnet -> subnet (subnet child contained-by vnet)
    if (ntl === "microsoft.network/virtualnetworks") {
      for (const sn of asArray(props.subnets)) {
        const snUrn = urnById.get(str(sn?.id).toLowerCase());
        if (snUrn) addEdge(edge(snUrn, selfUrn, "contains"));
      }
    }

    // NIC -> vnet (depends-on)
    if (ntl === "microsoft.network/networkinterfaces") {
      for (const vnetId of nicVnetIds(props)) {
        const vnetUrn = urnById.get(vnetId.toLowerCase());
        if (vnetUrn) addEdge(edge(selfUrn, vnetUrn, "depends-on"));
      }
    }

    // VM -> NIC and VM -> vnet (depends-on)
    if (ntl === "microsoft.compute/virtualmachines") {
      for (const nicId of vmNicIds(props)) {
        const nicUrn = urnById.get(nicId.toLowerCase());
        if (nicUrn) addEdge(edge(selfUrn, nicUrn, "depends-on"));
        const vnetUrn = nicToVnetUrn.get(nicId.toLowerCase());
        if (vnetUrn) addEdge(edge(selfUrn, vnetUrn, "depends-on"));
      }
    }
  }

  return { resources: [...resById.values()], edges: [...edgeMap.values()] };
}

/* -------------------------------------------------------------------------- */
/* Mappers                                                                    */
/* -------------------------------------------------------------------------- */

function toResource(row: AzureRow, subId: string): CloudResource {
  const nativeType = (row.type ?? "unknown").trim() || "unknown";
  const service = azureService(nativeType);
  const location = (row.location ?? "").trim() || null;
  const { kind } = mapAzureType(nativeType);
  const tags = normalizeAzureTags(row.tags);
  const props = row.properties ?? {};
  const provisioningState = str(props.provisioningState) || null;
  const name = (row.name ?? "").trim() || row.id;

  return {
    urn: makeUrn({ provider: "azure", account: subId, region: location, service, nativeId: row.id }),
    provider: "azure",
    account: subId,
    region: location,
    service,
    kind,
    nativeType,
    name,
    nativeId: row.id,
    environment: envFromTags(tags),
    status: mapAzureStatus(provisioningState),
    tags,
    attributes: {
      nativeType,
      resourceGroup: row.resourceGroup ?? null,
      subscriptionId: row.subscriptionId ?? subId,
      location,
      azureKind: str(row.kind) || null,
      sku: row.sku ?? null,
      provisioningState,
    },
    relationships: [],
    source: "live",
    discoveredAt: new Date().toISOString(),
  };
}

function rgResourceId(rg: string, subId: string): string {
  return `/subscriptions/${subId}/resourceGroups/${rg}`;
}

function rgResource(rg: string, subId: string): CloudResource {
  const id = rgResourceId(rg, subId);
  const service = "Resources/resourceGroups";
  return {
    urn: makeUrn({ provider: "azure", account: subId, region: null, service, nativeId: id }),
    provider: "azure",
    account: subId,
    region: null,
    service,
    kind: "unknown",
    nativeType: "Microsoft.Resources/resourceGroups",
    name: rg,
    nativeId: id,
    environment: undefined,
    status: "healthy",
    tags: {},
    attributes: { nativeType: "Microsoft.Resources/resourceGroups", resourceGroup: rg, subscriptionId: subId },
    relationships: [],
    source: "live",
    discoveredAt: new Date().toISOString(),
  };
}

function subnetResource(sn: Record<string, unknown>, vnet: AzureRow, subId: string): CloudResource {
  const id = str(sn.id);
  const location = (vnet.location ?? "").trim() || null;
  const service = "Network/virtualNetworks/subnets";
  const snProps = (sn.properties ?? {}) as Record<string, unknown>;
  return {
    urn: makeUrn({ provider: "azure", account: subId, region: location, service, nativeId: id }),
    provider: "azure",
    account: subId,
    region: location,
    service,
    kind: "network",
    nativeType: "Microsoft.Network/virtualNetworks/subnets",
    name: str(sn.name) || id,
    nativeId: id,
    environment: undefined,
    status: mapAzureStatus(str(snProps.provisioningState) || null),
    tags: {},
    attributes: {
      nativeType: "Microsoft.Network/virtualNetworks/subnets",
      resourceGroup: vnet.resourceGroup ?? null,
      subscriptionId: subId,
      location,
      vnet: vnet.name ?? null,
      addressPrefix: snProps.addressPrefix ?? snProps.addressPrefixes ?? null,
    },
    relationships: [],
    source: "live",
    discoveredAt: new Date().toISOString(),
  };
}

/** `Microsoft.Network/virtualNetworks` -> `Network/virtualNetworks`. */
function azureService(nativeType: string): string {
  return nativeType.replace(/^microsoft\./i, "").trim() || nativeType;
}

/** NIC ipConfigurations[].properties.subnet.id -> parent vnet id(s). */
function nicVnetIds(props: Record<string, unknown> | null | undefined): string[] {
  const out: string[] = [];
  for (const cfg of asArray(props?.ipConfigurations)) {
    const cfgProps = (cfg.properties ?? {}) as Record<string, unknown>;
    const subnet = (cfgProps.subnet ?? {}) as Record<string, unknown>;
    const subnetId = str(subnet.id);
    if (!subnetId) continue;
    const vnetId = subnetId.split("/subnets/")[0];
    if (vnetId && vnetId !== subnetId) out.push(vnetId);
  }
  return out;
}

/** VM networkProfile.networkInterfaces[].id -> NIC id(s). */
function vmNicIds(props: Record<string, unknown> | null | undefined): string[] {
  const profile = props?.networkProfile as Record<string, unknown> | undefined;
  const out: string[] = [];
  for (const nic of asArray(profile?.networkInterfaces)) {
    const id = str(nic?.id);
    if (id) out.push(id);
  }
  return out;
}

function edge(source: string, target: string, kind: GraphEdge["kind"]): GraphEdge {
  return { id: `${source}|${target}|${kind}`, source, target, kind };
}

function normalizeAzureTags(tags?: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (tags && typeof tags === "object") {
    for (const [k, v] of Object.entries(tags)) {
      if (typeof k === "string" && k.length > 0) out[k] = typeof v === "string" ? v : String(v ?? "");
    }
  }
  return out;
}

function envFromTags(tags: Record<string, string>): string | undefined {
  for (const k of ["Environment", "environment", "env", "Env", "Stage", "stage"]) {
    if (tags[k]) return normalizeEnvironment(tags[k]);
  }
  return undefined;
}

function mapAzureStatus(raw: string | null): ResourceStatus {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (/(succeeded|running|available|ready|online|active|enabled)/.test(s)) return "healthy";
  if (/(deallocated|stopped|disabled|deleted)/.test(s)) return "stopped";
  if (/(failed|canceled|cancelled|error|degraded)/.test(s)) return "degraded";
  if (/(creating|updating|deleting|provisioning|accepted|pending|moving|resizing)/.test(s)) return "degraded";
  return "unknown";
}

function toAdapterError(scope: string, err: unknown): AdapterError {
  const e = err as { code?: string; name?: string; statusCode?: number; message?: string };
  const code = e?.code ?? e?.name ?? (e?.statusCode ? `HTTP ${e.statusCode}` : "UnknownError");
  const message = e?.message ?? String(err);
  const retryable = /throttl|timeout|rate|429|503|500|ECONNRESET|ETIMEDOUT/i.test(message);
  return { provider: "azure", scope, code, message, retryable };
}

/* -------------------------------------------------------------------------- */
/* Small value helpers                                                        */
/* -------------------------------------------------------------------------- */

function asArray(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
