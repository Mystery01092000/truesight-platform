"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Surface } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { PillTabs } from "@/components/ui/PillTabs";
import { Reveal } from "@/components/ui/Reveal";
import { getKbDocuments, deleteKbDocument, type KbDocument } from "@/lib/kb/client";
import type { KbSourceType } from "@/lib/kb/types";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

const SOURCE_OPTIONS: { value: KbSourceType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "s3", label: "S3" },
  { value: "resource_snapshot", label: "Snapshots" },
  { value: "github", label: "GitHub" },
  { value: "terraform_state", label: "Terraform" },
];

const SOURCE_DOT: Record<KbSourceType, string> = {
  s3: "bg-accent-blue",
  resource_snapshot: "bg-accent-green",
  github: "bg-mute",
  terraform_state: "bg-iris",
};

const LIMIT = 20;

function SourceCell({ source }: { source: KbSourceType }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${SOURCE_DOT[source]}`} aria-hidden />
      <span className="capitalize text-body">{source.replace(/_/g, " ")}</span>
    </span>
  );
}

export function KbDocumentList() {
  const [documents, setDocuments] = useState<KbDocument[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [source, setSource] = useState<KbSourceType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKbDocuments({
        source: source === "all" ? undefined : source,
        limit: LIMIT,
        offset,
      });
      setDocuments(data.documents);
      setCount(data.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, offset]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document and all its chunks?")) return;
    setDeletingId(id);
    try {
      await deleteKbDocument(id);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = useMemo<ColumnDef<KbDocument>[]>(
    () => [
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <SourceCell source={row.original.source} />,
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate text-ink">{row.original.title || "—"}</div>
            <div className="truncate font-mono text-[12px] text-ash">
              {row.original.externalId}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "chunkCount",
        header: "Chunks",
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-body">{row.original.chunkCount}</span>
        ),
      },
      {
        accessorKey: "lastIngestedAt",
        header: "Last ingested",
        cell: ({ row }) => (
          <span className="text-label text-body">
            {row.original.lastIngestedAt ? formatDate(row.original.lastIngestedAt) : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
            disabled={deletingId === row.original.id}
            className="ml-auto"
            aria-label={`Delete ${row.original.title || row.original.externalId}`}
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deletingId],
  );

  const totalPages = Math.max(1, Math.ceil(count / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <Reveal delay={0.15}>
      <Surface level={1} radius="lg" className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Documents
          </h2>
          <PillTabs
            value={source}
            onChange={(v) => {
              setSource(v as KbSourceType | "all");
              setOffset(0);
            }}
            items={SOURCE_OPTIONS}
            aria-label="Filter documents by source"
          />
        </div>

        {error && (
          <p className="mb-3 text-label leading-[1.5] text-accent-red">{error}</p>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-surface-elevated" />
            ))}
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={documents}
              emptyMessage="No documents match this filter."
            />

            <div className="mt-4 flex items-center justify-between">
              <span className="text-label text-mute">
                {count > 0 ? (
                  <>
                    Showing {offset + 1}-{Math.min(offset + LIMIT, count)} of {count}
                  </>
                ) : (
                  "0 documents"
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                  disabled={offset === 0}
                >
                  <ChevronLeft size={14} strokeWidth={1.75} />
                </Button>
                <span className="min-w-[4rem] text-center font-mono text-label text-body">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setOffset((o) => o + LIMIT)}
                  disabled={offset + LIMIT >= count}
                >
                  <ChevronRight size={14} strokeWidth={1.75} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Surface>
    </Reveal>
  );
}
