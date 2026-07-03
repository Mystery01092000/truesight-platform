/**
 * The `integration_accounts` identity each cost source's sync runs are recorded
 * under (see lib/integrations/sync/cost-sync.ts). These rows are source
 * registrations, not real cloud accounts — surfaces that count or list connected
 * accounts (overview, landing stats, settings, topology coverage) must exclude
 * them via {@link COST_SOURCE_EXTERNAL_IDS}.
 */
export const COST_SOURCES: Record<
  "aws" | "azure",
  { externalId: string; displayName: string }
> = {
  aws: { externalId: "cost-explorer", displayName: "AWS Cost Explorer" },
  azure: { externalId: "cost-management", displayName: "Azure Cost Management" },
};

export const COST_SOURCE_EXTERNAL_IDS: string[] = Object.values(COST_SOURCES).map(
  (s) => s.externalId,
);
