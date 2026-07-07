/** Terraform resource-name slug: [a-z][a-z0-9_]*, deterministic from a label. */
export function tfSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!base) return "resource";
  return /^[a-z]/.test(base) ? base : `r_${base}`;
}
