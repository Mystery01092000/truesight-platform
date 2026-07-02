import "server-only";

import { desc } from "drizzle-orm";

import { db } from "@/db";
import { resourceSnapshots } from "@/db/schema";
import type { KbDocumentInput } from "@/lib/kb/types";

/**
 * Build a human-readable summary of a resource snapshot for semantic search.
 */
function formatResourceSummary(row: typeof resourceSnapshots.$inferSelect): string {
  const parts: string[] = [];

  parts.push(`Provider: ${row.provider ?? "unknown"}`);
  if (row.account) parts.push(`Account: ${row.account}`);
  if (row.region) parts.push(`Region: ${row.region}`);
  if (row.service) parts.push(`Service: ${row.service}`);
  if (row.type) parts.push(`Type: ${row.type}`);
  if (row.nativeType) parts.push(`Native Type: ${row.nativeType}`);
  if (row.name) parts.push(`Name: ${row.name}`);
  if (row.nativeId) parts.push(`Native ID: ${row.nativeId}`);
  if (row.status) parts.push(`Status: ${row.status}`);
  if (row.environment) parts.push(`Environment: ${row.environment}`);

  const tags = row.tags;
  if (tags && Object.keys(tags).length > 0) {
    parts.push(`Tags: ${JSON.stringify(tags, null, 2)}`);
  }

  const attributes = row.attributes;
  if (attributes && Object.keys(attributes).length > 0) {
    parts.push(`Attributes: ${JSON.stringify(attributes, null, 2)}`);
  }

  return parts.join("\n");
}

/**
 * Generate KB documents from the latest resource snapshot per URN.
 *
 * READ-ONLY: queries the resource_snapshots table.
 */
export async function listResourceDocuments(): Promise<KbDocumentInput[]> {
  try {
    const rows = await db
      .select()
      .from(resourceSnapshots)
      .orderBy(desc(resourceSnapshots.capturedAt));

    const latestByUrn = new Map<string, typeof resourceSnapshots.$inferSelect>();

    for (const row of rows) {
      const existing = latestByUrn.get(row.urn);
      if (!existing || (row.capturedAt?.getTime() ?? 0) > (existing.capturedAt?.getTime() ?? 0)) {
        latestByUrn.set(row.urn, row);
      }
    }

    const documents: KbDocumentInput[] = [];

    for (const row of latestByUrn.values()) {
      documents.push({
        source: "resource_snapshot",
        externalId: row.urn,
        title: row.name ?? row.urn,
        content: formatResourceSummary(row),
        metadata: {
          provider: row.provider,
          account: row.account,
          region: row.region,
          service: row.service,
          type: row.type,
          urn: row.urn,
        },
      });
    }

    return documents;
  } catch (err) {
    console.error("[kb/resources] Failed to list resource documents:", err);
    return [];
  }
}
