import type { ForgeService } from "./types";
import { AWS_NETWORK } from "./aws-network";
import { AWS_COMPUTE } from "./aws-compute";
import { AWS_PLATFORM } from "./aws-platform";
import { AZURE_NETWORK } from "./azure-network";
import { AZURE_WORKLOADS } from "./azure-workloads";

export const FORGE_SERVICES: ForgeService[] = [
  ...AWS_NETWORK,
  ...AWS_COMPUTE,
  ...AWS_PLATFORM,
  ...AZURE_NETWORK,
  ...AZURE_WORKLOADS,
];

const byId = new Map(FORGE_SERVICES.map((s) => [s.id, s]));

export function getService(id: string): ForgeService | undefined {
  return byId.get(id);
}

export const SERVICE_IDS = FORGE_SERVICES.map((s) => s.id);

export type {
  ForgeService,
  ForgeField,
  TfContext,
  TfFragment,
  ForgeProvider,
  ForgeCategory,
} from "./types";
