"use client";

import { useEffect, useState } from "react";
import { FileText, Layers, Clock } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { getKbStatus, type KbStatusResponse } from "@/lib/kb/client";
import type { KbSourceType } from "@/lib/kb/types";
import { formatDate, formatNumber } from "@/lib/utils/format";

const SOURCE_LABEL: Record<KbSourceType, string> = {
  s3: "S3",
  resource_snapshot: "Snapshots",
  github: "GitHub",
  terraform_state: "Terraform",
};

const SOURCE_DOT: Record<KbSourceType, string> = {
  s3: "bg-accent-blue",
  resource_snapshot: "bg-accent-green",
  github: "bg-mute",
  terraform_state: "bg-iris",
};

export function KbStatusCards() {
  const [status, setStatus] = useState<KbStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getKbStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load status");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Reveal>
        <Surface level={1} radius="lg" className="p-5">
          <p className="text-[14px] leading-[1.6] text-accent-red">{error}</p>
        </Surface>
      </Reveal>
    );
  }

  const stats = [
    {
      label: "Documents",
      value: status ? formatNumber(status.documentCount) : "—",
      icon: FileText,
      hint: "ingested sources",
    },
    {
      label: "Chunks",
      value: status ? formatNumber(status.chunkCount) : "—",
      icon: Layers,
      hint: "searchable vectors",
    },
    {
      label: "Last ingest",
      value: status?.lastIngestedAt ? formatDate(status.lastIngestedAt) : "—",
      icon: Clock,
      hint: "most recent sync",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 0.06}>
          <Surface level={1} radius="lg" className="p-5">
            <div className="flex items-center gap-2 text-label text-mute">
              <s.icon size={14} strokeWidth={1.75} />
              {s.label}
            </div>
            <div className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.5px] text-ink tabular-nums">
              {s.value}
            </div>
            <div className="mt-2 text-[12px] text-mute">{s.hint}</div>
          </Surface>
        </Reveal>
      ))}

      <Reveal delay={0.18} className="sm:col-span-3">
        <Surface level={1} radius="lg" className="p-5">
          <h3 className="text-label text-mute">Source breakdown</h3>
          {status && status.sources.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {status.sources.map((s) => (
                <Badge key={s.source} className="font-mono tabular-nums">
                  <span
                    className={`size-1.5 rounded-full ${SOURCE_DOT[s.source]}`}
                    aria-hidden
                  />
                  {SOURCE_LABEL[s.source]}{" "}
                  <span className="text-ash">{formatNumber(s.count)}</span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-label text-ash">No sources ingested yet.</p>
          )}
        </Surface>
      </Reveal>
    </div>
  );
}
