"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

import { Surface } from "@/components/ui/Surface";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * KbAskPanel — the "Ask Argus" RAG island. Streams a grounded answer from
 * POST /api/kb/answer (SSE: delta* → done|error) with a graceful fallback to
 * the non-stream JSON variant when streaming is unavailable. Citations render
 * as numbered chips linking to their source documents. Retrieval is read-only
 * over the indexed knowledge base — the estate is never touched.
 */

interface Citation {
  n: number;
  chunkId: string;
  documentId: string;
  title?: string;
  url?: string;
}

type Phase = "idle" | "waiting" | "streaming" | "done" | "error";

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.message || body.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/** Inline answer text with `[n]` citation markers rendered as iris chips. */
function AnswerText({ text, citations }: { text: string; citations: Citation[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-body">
      {parts.map((part, i) => {
        const marker = /^\[(\d+)\]$/.exec(part);
        if (!marker) return <span key={i}>{part}</span>;
        const n = Number(marker[1]);
        const citation = citations.find((c) => c.n === n);
        return (
          <sup key={i}>
            <span
              className="mx-0.5 inline-flex items-center rounded-xs bg-iris-soft px-1 font-mono text-[10px] leading-[1.6] text-iris"
              title={citation?.title ?? citation?.documentId}
            >
              {n}
            </span>
          </sup>
        );
      })}
    </p>
  );
}

function CitationChip({ citation }: { citation: Citation }) {
  const label = citation.title || citation.documentId;
  const inner = (
    <>
      <span className="font-mono text-[11px] tabular-nums text-iris">[{citation.n}]</span>
      <span className="max-w-56 truncate">{label}</span>
      {citation.url ? (
        <ExternalLink size={11} strokeWidth={1.75} className="shrink-0 text-mute" />
      ) : null}
    </>
  );
  const chipClass = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-elevated",
    "px-2.5 py-1 text-[12px] leading-[1.5] text-body",
  );
  if (citation.url) {
    return (
      <a
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
          chipClass,
          "transition-colors duration-150 ease-smooth hover:border-hairline-strong hover:text-ink",
        )}
      >
        {inner}
      </a>
    );
  }
  return (
    <span className={chipClass} title={citation.documentId}>
      {inner}
    </span>
  );
}

export function KbAskPanel() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loading = phase === "waiting" || phase === "streaming";

  async function consumeSse(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sawText = false;
    let sawTerminal = false;

    const handleEvent = (payload: string) => {
      let event: { type?: string; text?: string; citations?: Citation[]; message?: string };
      try {
        event = JSON.parse(payload) as typeof event;
      } catch {
        return;
      }
      if (event.type === "delta" && typeof event.text === "string") {
        const text = event.text;
        sawText = true;
        setAnswer((prev) => prev + text);
        setPhase("streaming");
      } else if (event.type === "done") {
        sawTerminal = true;
        setCitations(Array.isArray(event.citations) ? event.citations : []);
        setPhase("done");
      } else if (event.type === "error") {
        sawTerminal = true;
        setError(event.message || "Answer failed.");
        setPhase("error");
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of block.split("\n")) {
          if (line.startsWith("data: ")) handleEvent(line.slice(6));
        }
      }
    }

    if (!sawTerminal) {
      // Connection ended without a terminal event — surface what we have.
      if (sawText) setPhase("done");
      else throw new Error("stream ended early");
    }
  }

  async function askNonStreaming(q: string, signal: AbortSignal): Promise<void> {
    const res = await fetch("/api/kb/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
      signal,
    });
    if (!res.ok) throw new Error(await parseErrorResponse(res));
    const body = (await res.json()) as { answer: string | null; citations?: Citation[] };
    setAnswer(body.answer ?? "");
    setCitations(body.citations ?? []);
    setPhase("done");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("waiting");
    setAnswer("");
    setCitations([]);
    setError(null);

    try {
      const res = await fetch("/api/kb/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setError(await parseErrorResponse(res));
        setPhase("error");
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && res.body) {
        await consumeSse(res.body);
      } else {
        // Server answered with plain JSON — render it directly.
        const body = (await res.json()) as { answer: string | null; citations?: Citation[] };
        setAnswer(body.answer ?? "");
        setCitations(body.citations ?? []);
        setPhase("done");
      }
    } catch {
      if (controller.signal.aborted) return;
      // Streaming failed — fall back to the non-stream JSON variant once.
      try {
        await askNonStreaming(q, controller.signal);
      } catch (fallbackErr) {
        if (controller.signal.aborted) return;
        setError(
          fallbackErr instanceof Error ? fallbackErr.message : "Answer failed.",
        );
        setPhase("error");
      }
    }
  }

  const emptyAnswer = phase === "done" && answer.trim() === "" && citations.length === 0;

  return (
    <Surface level={1} radius="lg" className="p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className="grid size-6 place-items-center rounded-sm bg-iris-soft"
            aria-hidden
          >
            <Sparkles size={13} strokeWidth={1.75} className="text-iris" />
          </span>
          <h2 className="text-[15px] font-medium leading-[1.4] tracking-[0.2px] text-ink">
            Ask Argus
          </h2>
        </div>
        <span className="text-[12px] text-mute">
          grounded in the knowledge base · cited
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about the estate — drift, deployments, Terraform, GitHub..."
          icon={<Sparkles size={16} strokeWidth={1.75} />}
          className="flex-1"
          aria-label="Ask Argus a question"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Answering..." : "Ask"}
        </Button>
      </form>

      {phase === "waiting" && (
        <div className="mt-4" aria-label="Argus is thinking" role="status">
          <Skeleton.Text lines={3} />
        </div>
      )}

      {(phase === "streaming" || phase === "done" || (phase === "error" && answer)) &&
        answer !== "" && (
          <div className="mt-4">
            <AnswerText text={answer} citations={citations} />
            {phase === "streaming" && (
              <span role="status" aria-label="Argus is streaming the answer">
                <Skeleton.Block className="mt-2 h-3.5 w-24" />
              </span>
            )}
          </div>
        )}

      {emptyAnswer && (
        <p className="mt-4 text-[13px] leading-[1.6] text-mute">
          Argus has no indexed context for that question yet. Ingest more sources,
          then ask again.
        </p>
      )}

      {phase === "error" && (
        <p className="mt-4 text-[13px] leading-[1.5] text-critical" role="alert">
          {error ?? "Answer failed."}
        </p>
      )}

      {citations.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <div className="text-[11px] uppercase tracking-[0.6px] text-ash">Sources</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {citations.map((c) => (
              <CitationChip key={c.chunkId} citation={c} />
            ))}
          </div>
        </div>
      )}
    </Surface>
  );
}
