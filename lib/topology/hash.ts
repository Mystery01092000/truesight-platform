import type { TopoEnvScope, TopoLayoutMode, TopoProvider } from "./types";

/**
 * Stable content hash for the topology layout cache. The expensive step of a
 * topology render is the server-side ELK pass — but its output depends ONLY on
 * graph identity (which nodes, which edges) and the layout mode, never on
 * mutable per-node data like status or drift. Hashing (sorted URNs + sorted
 * edge triples + mode + scope + provider) therefore gives a key that is stable
 * across requests and only changes when the shape of the estate changes —
 * exactly when a re-layout is actually needed.
 *
 * Pure and dependency-free: FNV-1a over a canonical string, run twice with
 * independent seeds for a 64-bit hex key (collision-safe at estate scale).
 */

function fnv1a(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function topologyContentHash(args: {
  urns: Iterable<string>;
  edges: readonly { source: string; target: string; kind: string }[];
  mode: TopoLayoutMode;
  scope: TopoEnvScope;
  provider: TopoProvider;
}): string {
  const urns = [...args.urns].sort();
  const triples = args.edges
    .map((e) => `${e.source}>${e.target}>${e.kind}`)
    .sort();
  const canonical = `${args.mode}|${args.scope}|${args.provider}|${urns.join(",")}|${triples.join(",")}`;
  const a = fnv1a(canonical, 0x811c9dc5);
  const b = fnv1a(canonical, 0x9747b28c);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
