import {
  Activity,
  Container,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  Network,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ForgeCategory } from "@/lib/forge/catalog";

/** Category → glyph for palette tiles and canvas nodes. */
export const CATEGORY_ICON: Record<ForgeCategory, LucideIcon> = {
  network: Network,
  compute: Cpu,
  storage: HardDrive,
  database: Database,
  serverless: Zap,
  containers: Container,
  identity: KeyRound,
  observability: Activity,
};

/** Provider accent hexes — mirrors the topology minimap tints. */
export const PROVIDER_HEX: Record<"aws" | "azure", string> = {
  aws: "#ffc533",
  azure: "#57c1ff",
};
