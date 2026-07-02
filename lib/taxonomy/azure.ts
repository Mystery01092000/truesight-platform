import type { ResourceKind, ServiceCategory } from './index';

/**
 * Maps an Azure resource type onto Argus's canonical taxonomy.
 *
 * Azure resource types are namespaced as `Microsoft.<Provider>/<resourceType>`,
 * e.g. `Microsoft.Network/virtualNetworks`, `Microsoft.Compute/virtualMachines`,
 * `Microsoft.DBforPostgreSQL/flexibleServers`. Resolution is primarily by the
 * top-level provider namespace, with a few sub-type refinements. Unrecognised
 * input falls back to `{ kind: 'unknown', category: 'other' }`.
 */
export function mapAzureType(nativeType: string): { kind: ResourceKind; category: ServiceCategory } {
  const raw = nativeType.trim();
  if (!raw) return { kind: 'unknown', category: 'other' };

  const namespace = extractAzureNamespace(raw);

  // Refinement: Microsoft.Web hosts both app-service sites (containers) and
  // serverless function apps — key off the sub-type when present.
  if (namespace === 'microsoft.web') {
    const sub = extractAzureSubType(raw);
    if (sub.includes('serverfarm')) return { kind: 'compute', category: 'compute' };
    return { kind: 'container', category: 'containers' };
  }

  // Refinement: any Microsoft.DBfor* provider (PostgreSQL / MySQL / MariaDB) -> database.
  if (namespace.startsWith('microsoft.dbfor')) {
    return { kind: 'database', category: 'database' };
  }

  return AZURE_NAMESPACE_MAP[namespace] ?? { kind: 'unknown', category: 'other' };
}

/** Lowercase Azure provider namespace → { kind, category }. */
const AZURE_NAMESPACE_MAP: Record<string, { kind: ResourceKind; category: ServiceCategory }> = {
  // Compute
  'microsoft.compute': { kind: 'compute', category: 'compute' },
  'microsoft.classiccompute': { kind: 'compute', category: 'compute' },
  'microsoft.batch': { kind: 'compute', category: 'compute' },

  // Containers / registry
  'microsoft.containerservice': { kind: 'container', category: 'containers' }, // AKS
  'microsoft.containerinstance': { kind: 'container', category: 'containers' },
  'microsoft.app': { kind: 'container', category: 'containers' }, // Container Apps
  'microsoft.containerregistry': { kind: 'registry', category: 'containers' },

  // Networking
  'microsoft.network': { kind: 'network', category: 'networking' },
  'microsoft.cdn': { kind: 'cdn', category: 'networking' },
  'microsoft.frontdoor': { kind: 'cdn', category: 'networking' },

  // Storage
  'microsoft.storage': { kind: 'storage', category: 'storage' },
  'microsoft.classicstorage': { kind: 'storage', category: 'storage' },
  'microsoft.netapp': { kind: 'storage', category: 'storage' },

  // Databases (microsoft.sql covers servers, servers/databases, managedinstances)
  'microsoft.sql': { kind: 'database', category: 'database' },
  'microsoft.documentdb': { kind: 'database', category: 'database' }, // Cosmos DB
  'microsoft.cache': { kind: 'database', category: 'database' }, // Redis
  'microsoft.dbforpostgresql': { kind: 'database', category: 'database' },
  'microsoft.dbformysql': { kind: 'database', category: 'database' },
  'microsoft.dbformariadb': { kind: 'database', category: 'database' },

  // Identity & security
  'microsoft.authorization': { kind: 'iam', category: 'security' },
  'microsoft.managedidentity': { kind: 'iam', category: 'security' },
  'microsoft.aad': { kind: 'iam', category: 'security' },
  'microsoft.aadiam': { kind: 'iam', category: 'security' },

  // Secrets / crypto
  'microsoft.keyvault': { kind: 'secret', category: 'security' },

  // AI / ML / analytics
  'microsoft.cognitiveservices': { kind: 'ai', category: 'ai-ml' },
  'microsoft.machinelearningservices': { kind: 'ai', category: 'ai-ml' },
  'microsoft.search': { kind: 'ai', category: 'ai-ml' },
  'microsoft.databricks': { kind: 'ai', category: 'ai-ml' }, // Databricks workspaces

  // Data movement / ETL
  'microsoft.datafactory': { kind: 'queue', category: 'integration' }, // Data Factory pipelines

  // Monitoring / observability
  'microsoft.insights': { kind: 'monitoring', category: 'observability' },
  'microsoft.operationalinsights': { kind: 'monitoring', category: 'observability' },
  'microsoft.monitor': { kind: 'monitoring', category: 'observability' },

  // Messaging / queues / eventing
  'microsoft.servicebus': { kind: 'queue', category: 'integration' },
  'microsoft.eventhub': { kind: 'queue', category: 'integration' },
  'microsoft.eventgrid': { kind: 'queue', category: 'integration' },

  // Management
  'microsoft.resources': { kind: 'unknown', category: 'management' },
};

/** `Microsoft.Network/virtualNetworks` -> `microsoft.network`. */
function extractAzureNamespace(nativeType: string): string {
  return (nativeType.split('/')[0] ?? '').toLowerCase();
}

/** `Microsoft.Web/serverfarms` -> `serverfarms`. */
function extractAzureSubType(nativeType: string): string {
  return (nativeType.split('/')[1] ?? '').toLowerCase();
}
