import { ClientSecretCredential, type TokenCredential } from "@azure/identity";
import { SubscriptionClient } from "@azure/arm-resources-subscriptions";
import { ResourceGraphClient } from "@azure/arm-resourcegraph";

/**
 * Azure credential resolution + read-only client factories for Truesight.
 *
 * READ-ONLY by construction: this module only wires up a Service Principal
 * credential and the two clients discovery needs — the Subscriptions client
 * (to resolve a subscription by display name) and the Resource Graph client
 * (to run a single KQL inventory). It never constructs a management/write
 * client and the adapter that consumes it only issues list/query operations.
 *
 * The Service Principal is read from the process environment
 * (`AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET`); the target
 * subscription is resolved by matching `AZURE_SUBSCRIPTION_NAME` against the
 * subscriptions the principal can see, failing loudly if it is not present.
 */

export interface AzureEnv {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionName: string;
  /** Optional focus resource group (a UI grouping hint, not a discovery filter). */
  resourceGroup?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    throw new Error(
      `Missing required Azure env var ${name}. Did you \`source .env.local\` (or run via a loader that reads it)?`,
    );
  }
  return v;
}

/** Read + validate the Azure Service Principal + subscription config from process.env. */
export function readAzureEnv(): AzureEnv {
  return {
    tenantId: requireEnv("AZURE_TENANT_ID"),
    clientId: requireEnv("AZURE_CLIENT_ID"),
    clientSecret: requireEnv("AZURE_CLIENT_SECRET"),
    subscriptionName: requireEnv("AZURE_SUBSCRIPTION_NAME"),
    resourceGroup: process.env.AZURE_RESOURCE_GROUP?.trim() || undefined,
  };
}

/** Build a read-only ClientSecretCredential (Service Principal) from resolved env. */
export function createAzureCredential(env: AzureEnv): ClientSecretCredential {
  return new ClientSecretCredential(env.tenantId, env.clientId, env.clientSecret);
}

export interface ResolvedSubscription {
  subscriptionId: string;
  displayName: string;
  state?: string;
  tenantId?: string;
}

/**
 * Resolve a subscription id by matching {@link subscriptionName} (case-insensitive)
 * against the subscriptions the credential can list. Throws with the visible names
 * if no match is found — discovery must never silently target the wrong estate.
 */
export async function resolveSubscription(
  credential: TokenCredential,
  subscriptionName: string,
): Promise<ResolvedSubscription> {
  const client = new SubscriptionClient(credential);
  const wanted = subscriptionName.trim().toLowerCase();
  const seen: string[] = [];

  for await (const sub of client.subscriptions.list()) {
    if (!sub.subscriptionId) continue;
    const name = (sub.displayName ?? "").trim();
    seen.push(name || sub.subscriptionId);
    if (name.toLowerCase() === wanted) {
      return {
        subscriptionId: sub.subscriptionId,
        displayName: name || sub.subscriptionId,
        state: typeof sub.state === "string" ? sub.state : undefined,
        tenantId: sub.tenantId ?? undefined,
      };
    }
  }

  throw new Error(
    `Azure subscription named "${subscriptionName}" not found for this Service Principal. ` +
      `Visible subscriptions: ${seen.length ? seen.join(", ") : "(none — check the principal's RBAC assignments)"}.`,
  );
}

/** Read-only Azure Resource Graph client (single KQL inventory over a subscription). */
export function createResourceGraphClient(credential: TokenCredential): ResourceGraphClient {
  return new ResourceGraphClient(credential);
}
