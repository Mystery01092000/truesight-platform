"use client";

import { useQuery } from "@tanstack/react-query";

/*
 * Shared landing-stats query — the hero atlas and the stats strip both read the
 * public /api/landing-stats snapshot through one queryKey, so the landing page
 * costs exactly one fetch no matter how many islands render from it.
 */

export type LandingStats = {
  resources: number;
  accounts: number;
  drift: number;
  coverage: number;
  providers: { aws: number; azure: number; github: number };
  updatedAt: string;
};

async function fetchLandingStats(): Promise<LandingStats> {
  const res = await fetch("/api/landing-stats", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`landing-stats ${res.status}`);
  return (await res.json()) as LandingStats;
}

export function useLandingStats() {
  return useQuery({
    queryKey: ["landing-stats"],
    queryFn: fetchLandingStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
