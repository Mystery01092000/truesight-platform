import { describe, expect, it } from "vitest";
import { AZURE_NETWORK, azureRg } from "@/lib/forge/catalog/azure-network";
import { AZURE_WORKLOADS } from "@/lib/forge/catalog/azure-workloads";
import type { ForgeNode } from "@/lib/forge/types";
import type { TfContext } from "@/lib/forge/catalog/types";

const rgNode: ForgeNode = { id: "rg", serviceId: "azure.resource_group", name: "prod rg", parentId: null, position: { x: 0, y: 0 }, config: {} };
const vnetNode: ForgeNode = { id: "vn", serviceId: "azure.vnet", name: "core", parentId: "rg", position: { x: 0, y: 0 }, config: { addressSpace: "10.10.0.0/16" } };
const subnetNode: ForgeNode = { id: "sn", serviceId: "azure.subnet", name: "apps", parentId: "vn", position: { x: 0, y: 0 }, config: { addressPrefix: "10.10.1.0/24" } };
const storageNode: ForgeNode = { id: "st", serviceId: "azure.storage_account", name: "blob", parentId: "rg", position: { x: 0, y: 0 }, config: { accountName: "forgeblob01", replication: "LRS" } };

const NAMES: Record<string, string> = { rg: "prod_rg", vn: "core", sn: "apps", st: "blob", vm: "web_vm", fn: "api_fn" };
const ctx: TfContext = {
  tfName: (id) => NAMES[id] ?? id,
  ancestorOfService: (id, svc) => {
    if (svc === "azure.resource_group" && id !== "rg") return rgNode;
    if (svc === "azure.vnet" && id === "sn") return vnetNode;
    if (svc === "azure.subnet" && id === "vm") return subnetNode;
    return undefined;
  },
  edgesFrom: (id) => (id === "fn" ? [storageNode] : []),
  awsRegion: "ap-south-1",
  azureLocation: "centralindia",
};

describe("azure network services", () => {
  it("resource group uses the configured location", () => {
    const rg = AZURE_NETWORK.find((s) => s.id === "azure.resource_group")!;
    expect(rg.toTf(rgNode, ctx).resource!.azurerm_resource_group!.prod_rg.location).toBe("centralindia");
  });
  it("azureRg helper resolves refs", () => {
    expect(azureRg(vnetNode, ctx)).toEqual({
      name: "${azurerm_resource_group.prod_rg.name}",
      location: "${azurerm_resource_group.prod_rg.location}",
    });
  });
  it("subnet references vnet + rg by name", () => {
    const subnet = AZURE_NETWORK.find((s) => s.id === "azure.subnet")!;
    expect(subnet.toTf(subnetNode, ctx).resource!.azurerm_subnet!.apps).toMatchObject({
      virtual_network_name: "${azurerm_virtual_network.core.name}",
      resource_group_name: "${azurerm_resource_group.prod_rg.name}",
      address_prefixes: ["10.10.1.0/24"],
    });
  });
});

describe("azure workload services", () => {
  it("registers all eight", () => {
    expect(AZURE_WORKLOADS.map((s) => s.id).sort()).toEqual([
      "azure.acr", "azure.container_app", "azure.function_app", "azure.linux_vm",
      "azure.log_analytics", "azure.sql", "azure.storage_account", "azure.windows_vm",
    ]);
  });
  it("linux vm emits a NIC and references it", () => {
    const vm = AZURE_WORKLOADS.find((s) => s.id === "azure.linux_vm")!;
    const vmNode: ForgeNode = { id: "vm", serviceId: "azure.linux_vm", name: "web vm", parentId: "sn", position: { x: 0, y: 0 }, config: { size: "Standard_B2s", adminUsername: "azureuser" } };
    const tf = vm.toTf(vmNode, ctx);
    expect(tf.resource!.azurerm_network_interface!.web_vm).toBeTruthy();
    expect(tf.resource!.azurerm_linux_virtual_machine!.web_vm).toMatchObject({
      admin_password: "${var.forge_vm_password}",
      network_interface_ids: ["${azurerm_network_interface.web_vm.id}"],
    });
  });
  it("sql emits server + database pair with variable password", () => {
    const sqlSvc = AZURE_WORKLOADS.find((s) => s.id === "azure.sql")!;
    const node: ForgeNode = { id: "db", serviceId: "azure.sql", name: "orders", parentId: "rg", position: { x: 0, y: 0 }, config: { adminLogin: "sqladmin", skuName: "S0" } };
    const tf = sqlSvc.toTf(node, { ...ctx, tfName: (id) => (id === "db" ? "orders" : NAMES[id] ?? id) });
    expect(tf.resource!.azurerm_mssql_server!.orders.administrator_login_password).toBe("${var.forge_db_password}");
    expect(tf.resource!.azurerm_mssql_database!.orders.server_id).toBe("${azurerm_mssql_server.orders.id}");
  });
  it("function app requires a storage account edge", () => {
    const fn = AZURE_WORKLOADS.find((s) => s.id === "azure.function_app")!;
    const node: ForgeNode = { id: "fn", serviceId: "azure.function_app", name: "api fn", parentId: "rg", position: { x: 0, y: 0 }, config: { nodeVersion: "22" } };
    const tf = fn.toTf(node, ctx);
    expect(tf.resource!.azurerm_linux_function_app!.api_fn.storage_account_name).toBe("${azurerm_storage_account.blob.name}");
    expect(() => fn.toTf(node, { ...ctx, edgesFrom: () => [] })).toThrow(/Storage Account/);
  });
});
