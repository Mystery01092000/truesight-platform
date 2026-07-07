import { getService } from "./catalog";
import type { TfContext, TfFragment } from "./catalog/types";
import type { ForgeCanvas, ForgeNode, ForgeValidationIssue } from "./types";
import { tfSlug } from "./slug";

const PROVIDER_VERSIONS = {
  aws: { source: "hashicorp/aws", version: "~> 6.0" },
  azurerm: { source: "hashicorp/azurerm", version: "~> 4.0" },
} as const;

/** Password-style variables services may reference; declared only when used. */
const KNOWN_VARIABLES: Record<string, { description: string }> = {
  forge_db_password: { description: "Database master password (TF_VAR_forge_db_password)" },
  forge_vm_password: { description: "VM admin password (TF_VAR_forge_vm_password)" },
};

/** Services allowed at top level even though they list container parents. */
const CONTAINER_OPTIONAL = new Set(["aws.security_group", "aws.rds_instance"]);

function buildNameMap(canvas: ForgeCanvas): Map<string, string> {
  const used = new Map<string, number>();
  const names = new Map<string, string>();
  // Sorted for determinism regardless of node array order.
  for (const node of [...canvas.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const base = tfSlug(node.name);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    names.set(node.id, n === 1 ? base : `${base}_${n}`);
  }
  return names;
}

function buildContext(canvas: ForgeCanvas, awsRegion: string, azureLocation: string): TfContext {
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  const names = buildNameMap(canvas);
  return {
    tfName: (id) => names.get(id) ?? "unknown",
    ancestorOfService: (id, serviceId) => {
      let cur = byId.get(id)?.parentId ?? null;
      while (cur) {
        const p = byId.get(cur);
        if (!p) return undefined;
        if (p.serviceId === serviceId) return p;
        cur = p.parentId;
      }
      return undefined;
    },
    edgesFrom: (id) =>
      canvas.edges
        .filter((e) => e.source === id)
        .map((e) => byId.get(e.target))
        .filter((n): n is ForgeNode => Boolean(n)),
    awsRegion,
    azureLocation,
  };
}

export function validateCanvas(canvas: ForgeCanvas): ForgeValidationIssue[] {
  const issues: ForgeValidationIssue[] = [];
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));
  for (const node of canvas.nodes) {
    const svc = getService(node.serviceId);
    if (!svc) {
      issues.push({ nodeId: node.id, message: `Unknown service "${node.serviceId}"` });
      continue;
    }
    if (!node.name.trim()) issues.push({ nodeId: node.id, message: "Name is required" });
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (node.parentId && !parent) {
      issues.push({ nodeId: node.id, message: "Parent node no longer exists" });
    } else if (parent && !svc.allowedParents.includes(parent.serviceId)) {
      issues.push({
        nodeId: node.id,
        message: `${svc.label} cannot live inside ${getService(parent.serviceId)?.label ?? parent.serviceId}`,
      });
    } else if (!parent && svc.allowedParents.length > 0 && !CONTAINER_OPTIONAL.has(svc.id)) {
      issues.push({
        nodeId: node.id,
        message: `${svc.label} must be placed inside: ${svc.allowedParents.map((p) => getService(p)?.label ?? p).join(" or ")}`,
      });
    }
    const parsed = svc.schema.safeParse(node.config);
    if (!parsed.success) {
      for (const err of parsed.error.issues) {
        issues.push({ nodeId: node.id, message: `${String(err.path.join("."))}: ${err.message}` });
      }
    }
  }
  return issues;
}

export function generateTf(
  canvas: ForgeCanvas,
  opts: { awsRegion?: string; azureLocation?: string } = {},
): { tf: Record<string, unknown> | null; issues: ForgeValidationIssue[] } {
  const issues = validateCanvas(canvas);
  if (issues.length > 0) return { tf: null, issues };
  if (canvas.nodes.length === 0) return { tf: null, issues: [{ nodeId: null, message: "Canvas is empty" }] };

  const awsRegion = opts.awsRegion ?? "ap-south-1";
  const azureLocation = opts.azureLocation ?? "centralindia";
  const ctx = buildContext(canvas, awsRegion, azureLocation);

  const resource: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const node of [...canvas.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    const svc = getService(node.serviceId)!;
    let frag: TfFragment;
    try {
      frag = svc.toTf(node, ctx);
    } catch (err) {
      issues.push({ nodeId: node.id, message: err instanceof Error ? err.message : String(err) });
      continue;
    }
    for (const [type, instances] of Object.entries(frag.resource ?? {})) {
      resource[type] = { ...(resource[type] ?? {}), ...instances };
    }
  }
  if (issues.length > 0) return { tf: null, issues };

  const providersInUse = new Set(canvas.nodes.map((n) => getService(n.serviceId)!.provider));
  const requiredProviders: Record<string, unknown> = {};
  const providerBlocks: Record<string, unknown> = {};
  if (providersInUse.has("aws")) {
    requiredProviders.aws = PROVIDER_VERSIONS.aws;
    providerBlocks.aws = { region: awsRegion };
  }
  if (providersInUse.has("azure")) {
    requiredProviders.azurerm = PROVIDER_VERSIONS.azurerm;
    providerBlocks.azurerm = { features: {} };
  }

  // Declare only the variables actually referenced anywhere in the doc.
  const serialized = JSON.stringify(resource);
  const variable: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(KNOWN_VARIABLES)) {
    if (serialized.includes(`\${var.${name}}`)) {
      variable[name] = { type: "string", sensitive: true, description: def.description };
    }
  }

  const tf: Record<string, unknown> = {
    terraform: { required_providers: requiredProviders },
    provider: providerBlocks,
    resource,
    ...(Object.keys(variable).length ? { variable } : {}),
  };
  return { tf, issues: [] };
}
