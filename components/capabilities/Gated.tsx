"use client";

import { useCapabilities } from "@/components/capabilities/CapabilityProvider";
import type { CapabilityKey } from "@/lib/capabilities";

/**
 * Renders children only while the capability is curated on. Off means gone —
 * no skeletons, no placeholders — so a curated view reads as intentional,
 * never broken.
 */
export function Gated({ cap, children }: { cap: CapabilityKey; children: React.ReactNode }) {
  const { isOn } = useCapabilities();
  if (!isOn(cap)) return null;
  return <>{children}</>;
}
