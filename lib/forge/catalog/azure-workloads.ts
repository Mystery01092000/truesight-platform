import { z } from "zod";
import type { ForgeService, TfContext } from "./types";
import type { ForgeNode } from "@/lib/forge/types";
import { forgeTags } from "./aws-network";
import { azureRg } from "./azure-network";

/** Nearest subnet ancestor's id ref + a NIC fragment shared by both VM shapes. */
function vmNic(node: ForgeNode, ctx: TfContext): { nicFragment: Record<string, Record<string, unknown>>; nicRef: string } {
  const sn = ctx.ancestorOfService(node.id, "azure.subnet");
  if (!sn) throw new Error(`${node.name}: must be placed inside a Subnet`);
  const rg = azureRg(node, ctx);
  const n = ctx.tfName(node.id);
  return {
    nicFragment: {
      [n]: {
        name: `${node.name.replace(/\s+/g, "-")}-nic`,
        location: rg.location,
        resource_group_name: rg.name,
        ip_configuration: [{
          name: "primary",
          subnet_id: `\${azurerm_subnet.${ctx.tfName(sn.id)}.id}`,
          private_ip_address_allocation: "Dynamic",
        }],
      },
    },
    nicRef: `\${azurerm_network_interface.${n}.id}`,
  };
}

const VM_SIZES = ["Standard_B2s", "Standard_D2s_v5", "Standard_D4s_v5"];

const linuxVm: ForgeService = {
  id: "azure.linux_vm",
  provider: "azure",
  label: "Linux VM",
  category: "compute",
  isContainer: false,
  allowedParents: ["azure.subnet"],
  defaultConfig: { size: "Standard_B2s", adminUsername: "azureuser" },
  schema: z.object({
    size: z.string().startsWith("Standard_"),
    adminUsername: z.string().regex(/^[a-z][a-z0-9]{2,31}$/),
  }),
  fields: [
    { key: "size", label: "VM size", type: "select", options: VM_SIZES.map((v) => ({ value: v, label: v })) },
    { key: "adminUsername", label: "Admin username", type: "text", required: true },
  ],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    const { nicFragment, nicRef } = vmNic(node, ctx);
    return {
      resource: {
        azurerm_network_interface: nicFragment,
        azurerm_linux_virtual_machine: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            location: rg.location,
            resource_group_name: rg.name,
            size: node.config.size,
            admin_username: node.config.adminUsername,
            admin_password: "${var.forge_vm_password}",
            disable_password_authentication: false,
            network_interface_ids: [nicRef],
            os_disk: { caching: "ReadWrite", storage_account_type: "Standard_LRS" },
            source_image_reference: { publisher: "Canonical", offer: "ubuntu-24_04-lts", sku: "server", version: "latest" },
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const windowsVm: ForgeService = {
  id: "azure.windows_vm",
  provider: "azure",
  label: "Windows VM",
  category: "compute",
  isContainer: false,
  allowedParents: ["azure.subnet"],
  defaultConfig: { size: "Standard_B2s", adminUsername: "azureadmin" },
  schema: z.object({
    size: z.string().startsWith("Standard_"),
    adminUsername: z.string().regex(/^[a-z][a-z0-9]{2,19}$/),
  }),
  fields: [
    { key: "size", label: "VM size", type: "select", options: VM_SIZES.map((v) => ({ value: v, label: v })) },
    { key: "adminUsername", label: "Admin username", type: "text", required: true },
  ],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    const { nicFragment, nicRef } = vmNic(node, ctx);
    return {
      resource: {
        azurerm_network_interface: nicFragment,
        azurerm_windows_virtual_machine: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-").slice(0, 15),
            location: rg.location,
            resource_group_name: rg.name,
            size: node.config.size,
            admin_username: node.config.adminUsername,
            admin_password: "${var.forge_vm_password}",
            network_interface_ids: [nicRef],
            os_disk: { caching: "ReadWrite", storage_account_type: "Standard_LRS" },
            source_image_reference: { publisher: "MicrosoftWindowsServer", offer: "WindowsServer", sku: "2022-datacenter-g2", version: "latest" },
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const storageAccount: ForgeService = {
  id: "azure.storage_account",
  provider: "azure",
  label: "Storage Account",
  category: "storage",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { accountName: "", replication: "LRS" },
  schema: z.object({
    accountName: z.string().regex(/^[a-z0-9]{3,24}$/, "3-24 lowercase letters/digits"),
    replication: z.enum(["LRS", "GRS", "ZRS"]),
  }),
  fields: [
    { key: "accountName", label: "Account name", type: "text", required: true },
    { key: "replication", label: "Replication", type: "select", options: ["LRS", "GRS", "ZRS"].map((v) => ({ value: v, label: v })) },
  ],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_storage_account: {
          [ctx.tfName(node.id)]: {
            name: node.config.accountName,
            location: rg.location,
            resource_group_name: rg.name,
            account_tier: "Standard",
            account_replication_type: node.config.replication,
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const sql: ForgeService = {
  id: "azure.sql",
  provider: "azure",
  label: "Azure SQL",
  category: "database",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { adminLogin: "sqladmin", skuName: "S0" },
  schema: z.object({
    adminLogin: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
    skuName: z.enum(["Basic", "S0", "S1", "P1"]),
  }),
  fields: [
    { key: "adminLogin", label: "Admin login", type: "text", required: true },
    { key: "skuName", label: "Database SKU", type: "select", options: ["Basic", "S0", "S1", "P1"].map((v) => ({ value: v, label: v })) },
  ],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    const n = ctx.tfName(node.id);
    return {
      resource: {
        azurerm_mssql_server: {
          [n]: {
            name: node.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
            location: rg.location,
            resource_group_name: rg.name,
            version: "12.0",
            administrator_login: node.config.adminLogin,
            administrator_login_password: "${var.forge_db_password}",
            tags: forgeTags(node.name),
          },
        },
        azurerm_mssql_database: {
          [n]: {
            name: `${node.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-db`,
            server_id: `\${azurerm_mssql_server.${n}.id}`,
            sku_name: node.config.skuName,
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const functionApp: ForgeService = {
  id: "azure.function_app",
  provider: "azure",
  label: "Function App",
  category: "serverless",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { nodeVersion: "22" },
  schema: z.object({ nodeVersion: z.enum(["18", "20", "22"]) }),
  fields: [{
    key: "nodeVersion",
    label: "Node.js version",
    type: "select",
    options: ["18", "20", "22"].map((v) => ({ value: v, label: `Node ${v}` })),
  }],
  toTf: (node, ctx) => {
    const storage = ctx.edgesFrom(node.id).find((t) => t.serviceId === "azure.storage_account");
    if (!storage) throw new Error(`${node.name}: connect a Storage Account (draw an edge to one)`);
    const rg = azureRg(node, ctx);
    const n = ctx.tfName(node.id);
    const sn = ctx.tfName(storage.id);
    return {
      resource: {
        azurerm_service_plan: {
          [n]: {
            name: `${node.name.replace(/\s+/g, "-")}-plan`,
            location: rg.location,
            resource_group_name: rg.name,
            os_type: "Linux",
            sku_name: "Y1",
          },
        },
        azurerm_linux_function_app: {
          [n]: {
            name: node.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
            location: rg.location,
            resource_group_name: rg.name,
            service_plan_id: `\${azurerm_service_plan.${n}.id}`,
            storage_account_name: `\${azurerm_storage_account.${sn}.name}`,
            storage_account_access_key: `\${azurerm_storage_account.${sn}.primary_access_key}`,
            site_config: { application_stack: { node_version: node.config.nodeVersion } },
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const containerApp: ForgeService = {
  id: "azure.container_app",
  provider: "azure",
  label: "Container App",
  category: "containers",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { image: "nginx:latest" },
  schema: z.object({ image: z.string().min(3) }),
  fields: [{ key: "image", label: "Container image", type: "text", required: true }],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    const n = ctx.tfName(node.id);
    const law = ctx.edgesFrom(node.id).find((t) => t.serviceId === "azure.log_analytics");
    const family = node.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    return {
      resource: {
        azurerm_container_app_environment: {
          [n]: {
            name: `${family}-env`,
            location: rg.location,
            resource_group_name: rg.name,
            ...(law ? { log_analytics_workspace_id: `\${azurerm_log_analytics_workspace.${ctx.tfName(law.id)}.id}` } : {}),
          },
        },
        azurerm_container_app: {
          [n]: {
            name: family,
            container_app_environment_id: `\${azurerm_container_app_environment.${n}.id}`,
            resource_group_name: rg.name,
            revision_mode: "Single",
            template: { container: [{ name: family, image: node.config.image, cpu: 0.5, memory: "1Gi" }] },
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const logAnalytics: ForgeService = {
  id: "azure.log_analytics",
  provider: "azure",
  label: "Log Analytics",
  category: "observability",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { retentionDays: 30 },
  schema: z.object({ retentionDays: z.number().int().min(30).max(730) }),
  fields: [{ key: "retentionDays", label: "Retention (days)", type: "number", min: 30, max: 730 }],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_log_analytics_workspace: {
          [ctx.tfName(node.id)]: {
            name: node.name.replace(/\s+/g, "-"),
            location: rg.location,
            resource_group_name: rg.name,
            sku: "PerGB2018",
            retention_in_days: node.config.retentionDays,
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

const acr: ForgeService = {
  id: "azure.acr",
  provider: "azure",
  label: "Container Registry",
  category: "containers",
  isContainer: false,
  allowedParents: ["azure.resource_group"],
  defaultConfig: { sku: "Basic" },
  schema: z.object({ sku: z.enum(["Basic", "Standard", "Premium"]) }),
  fields: [{ key: "sku", label: "SKU", type: "select", options: ["Basic", "Standard", "Premium"].map((v) => ({ value: v, label: v })) }],
  toTf: (node, ctx) => {
    const rg = azureRg(node, ctx);
    return {
      resource: {
        azurerm_container_registry: {
          [ctx.tfName(node.id)]: {
            name: node.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 50),
            location: rg.location,
            resource_group_name: rg.name,
            sku: node.config.sku,
            admin_enabled: false,
            tags: forgeTags(node.name),
          },
        },
      },
    };
  },
};

export const AZURE_WORKLOADS: ForgeService[] = [
  linuxVm, windowsVm, storageAccount, sql, functionApp, containerApp, logAnalytics, acr,
];
