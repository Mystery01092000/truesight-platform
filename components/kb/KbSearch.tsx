"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, ExternalLink } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils/cn";
import type { KbQueryResult, KbSourceType } from "@/lib/kb/types";
import { queryKb } from "@/lib/kb/client";

const SPRING = { type: "spring", stiffness: 220, damping: 26 } as const;

const SOURCE_TONE: Record<
  KbSourceType,
  { label: string; fill: string; text: string }
> = {
  s3: {
    label: "S3",
    fill: "bg-accent-blue-soft",
    text: "text-accent-blue",
  },
  resource_snapshot: {
    label: "Snapshot",
    fill: "bg-accent-green-soft",
    text: "text-accent-green",
  },
  github: {
    label: "GitHub",
    fill: "bg-surface-elevated",
    text: "text-mute",
  },
  terraform_state: {
    label: "Terraform",
    fill: "bg-iris-soft",
    text: "text-iris",
  },
};

function SourceBadge({ source }: { source: KbSourceType }) {
  const tone = SOURCE_TONE[source];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs px-2 py-0.5 text-[12px] leading-[1.5] tracking-[0.4px]",
        tone.fill,
        tone.text,
      )}
    >
      {tone.label}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-micro tabular-nums text-ash">
      {(score * 100).toFixed(0)}%
    </span>
  );
}

export function KbSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KbQueryResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await queryKb(query.trim(), { limit: 10 });
          setResults(data);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
        } finally {
          setHasSearched(true);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    // Force immediate search by bumping state; the debounced effect will fire.
    setQuery(query.trim());
  };

  const loading = isPending;

  return (
    <Surface level={1} radius="lg" className="p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
          Search knowledge base
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask across docs, snapshots, GitHub and Terraform state..."
          icon={<Search size={16} strokeWidth={1.75} />}
          className="flex-1"
          aria-label="Knowledge base query"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          Search
        </Button>
      </form>

      {error && (
        <p className="mt-3 text-label leading-[1.5] text-accent-red">{error}</p>
      )}

      <div className="mt-4 space-y-3">
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-md bg-surface-elevated"
              />
            ))}
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-[14px] leading-[1.6] text-mute">No results found.</p>
            <p className="mt-1 text-label text-ash">
              Try a different query or ingest more sources.
            </p>
          </div>
        )}

        {!loading &&
          results.map((r, i) => {
            const content = (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SourceBadge source={r.source} />
                  <span className="truncate font-mono text-[12px] text-ash">
                    {r.externalId}
                  </span>
                </div>
                {r.title && (
                  <div className="mt-1.5 truncate text-[14px] font-medium leading-[1.4] text-ink">
                    {r.title}
                  </div>
                )}
                <p className="mt-1 line-clamp-3 text-label leading-[1.5] text-body">
                  {r.content}
                </p>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[12px] text-iris hover:text-iris-bright"
                  >
                    {(() => {
                      try {
                        return new URL(r.url).hostname;
                      } catch {
                        return "Open";
                      }
                    })()}
                    <ExternalLink size={11} strokeWidth={1.75} />
                  </a>
                )}
              </div>
            );

            return reduced ? (
              <Reveal key={`${r.documentId}-${r.chunkId}`}>
                <Surface level={2} radius="md" className="flex gap-3 p-3">
                  {content}
                  <ScorePill score={r.score} />
                </Surface>
              </Reveal>
            ) : (
              <motion.div
                key={`${r.documentId}-${r.chunkId}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: i * 0.04 }}
              >
                <Surface level={2} radius="md" className="flex gap-3 p-3">
                  {content}
                  <ScorePill score={r.score} />
                </Surface>
              </motion.div>
            );
          })}
      </div>
    </Surface>
  );
}
