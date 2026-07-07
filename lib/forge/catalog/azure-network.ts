import { z } from "zod";
import type { ForgeService, TfContext } from "./types";
import type { ForgeNode } from "@/lib/forge/types";
import { forgeTags, zCidr } from "./aws-network";

/** Resource-group refs for the nearest RG ancestor. Validation guarantees presence. */
export function azureRg(node: ForgeNode, ctx: TfContext): { name: string; location: string } {
  const rg = ctx.ancestorOfService(node.id, "azure.resource_group");
  if (!rg) throw new Error(`${node.name}: must be placed inside a Resource Group`);
  const n = ctx.tfName(rg.id);
  return {
    name: `\${azurerm_resource_group.${n}.name}`,
    location: `\${azurerm_resource_group.${n}.location}`,
  };
}

const resourceGroup: ForgeService = {
  id: "azure.resource_group",
  provider: "azure",
  label: "Resource Group",
  category: "network",
  isContainer: true,
  allowedParents: [],
  defaultConfig: {},
  schema: z.object({}),
  fields: [],
  toTf: (node, ctx) => ({
    resource: {
      azurerm_resource_group: {
        [ctx.tfName(node.id)]: {
          name: node.name.replace(/\s+/g, "-"),
          location: ctx.azureLocation,
          tags: forgeTags(node.name),
        },
      },
    },
  }),
};

const vnet: ForgeService = {
  id: "azure.vnet",
  provider: "azure",
  label: "Virtual Network",
  category: "network",
  isContainer: true,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { addressSpace: "10.10.0.0/16" },
  schema: z.object({ addressSpace: zCidr }),
  fields: [{ key: "addressSpace", label: "Address space", type: "text", required: true, placeholder: "10.10.0.0/16" }],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_virtual_network: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            address_space: [node.config.addressSpace],
            location: rg.location,
            resource_group_name: rg.name,
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const subnet: ForgeService = {
  id: "azure.subnet",
  provider: "azure",
  label: "Subnet",
  category: "network",
  isContainer: true,
  allowedParents: ["azure.vnet"],
  defaultConfig: { addressPrefix: "10.10.1.0/24" },
  schema: z.object({ addressPrefix: zCidr }),
  fields: [{ key: "addressPrefix", label: "Address prefix", type: "text", required: true }],
  toTf: (node, ctx) => {
    const vn = ctx.ancestorOfService(node.id, "azure.vnet");
    if (!vn) throw new Error(`${node.name}: must be placed inside a Virtual Network`);
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_subnet: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            resource_group_name: rg.name,
            virtual_network_name: `\${azurerm_virtual_network.${ctx.tfName(vn.id)}.name}`,
            address_prefixes: [node.config.addressPrefix],
          },
        },
      },
    };
  },
};

const nsg: ForgeService = {
  id: "azure.nsg",
  provider: "azure",
  label: "Network Security Group",
  category: "network",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { allowPort: 443, sourceCidr: "0.0.0.0/0" },
  schema: z.object({ allowPort: z.number().int().min(0).max(65535), sourceCidr: zCidr }),
  fields: [
    { key: "allowPort", label: "Allow inbound port", type: "number", min: 0, max: 65535 },
    { key: "sourceCidr", label: "Source CIDR", type: "text" },
  ],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_network_security_group: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            location: rg.location,
            resource_group_name: rg.name,
            security_rule: [{
              name: `allow-${node.config.allowPort}`,
              priority: 100,
              direction: "Inbound",
              access: "Allow",
              protocol: "Tcp",
              source_port_range: "*",
              destination_port_range: String(node.config.allowPort),
              source_address_prefix: node.config.sourceCidr,
              destination_address_prefix: "*",
              description: "",
              destination_address_prefixes: [],
              destination_application_security_group_ids: [],
              destination_port_ranges: [],
              source_address_prefixes: [],
              source_application_security_group_ids: [],
              source_port_ranges: [],
            }],
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

export const AZURE_NETWORK: ForgeService[] = [resourceGroup, vnet, subnet, nsg];
