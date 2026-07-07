"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";

interface RunDrawerProps {
  open: boolean;
  planId: string;
  runId: string | null;
  kind: "plan" | "apply" | "destroy";
  onClose: () => void;
  onFinished: (status: string) => void;
}

/** Live terraform output — tails the run's SSE stream into a terminal pane. */
export function RunDrawer({ open, planId, runId, kind, onClose, onFinished }: RunDrawerProps) {
  const [log, setLog] = useState("");
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open || !runId) return;
    setLog("");
    setFinalStatus(null);
    const es = new EventSource(`/api/forge/plans/${planId}/runs/${runId}/stream`);
    es.addEventListener("log", (e) => {
      setLog((prev) => prev + (JSON.parse((e as MessageEvent).data) as string));
    });
    es.addEventListener("end", (e) => {
      const status = JSON.parse((e as MessageEvent).data) as string;
      setFinalStatus(status);
      onFinished(status);
      es.close();
    });
    es.onerror = () => {
      es.close();
      setFinalStatus((f) => f ?? "stream-lost");
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, runId, planId]);

  useEffect(() => {
    preRef.current?.scrollTo({ top: preRef.current.scrollHeight });
  }, [log]);

  return (
    <Drawer open={open} onClose={onClose} title={`terraform ${kind}`} width={640}>
      <div className="flex items-center gap-2 pb-3">
        {finalStatus === null ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-mute">
            <span className="size-2 animate-pulse rounded-full bg-[#7c8dff]" aria-hidden />
            running…
          </span>
        ) : (
          <Badge>{finalStatus}</Badge>
        )}
      </div>
      <pre
        ref={preRef}
        className="h-[70vh] overflow-auto rounded-lg border border-hairline bg-surface-base p-4 font-mono text-[12px] leading-[1.6] text-body"
      >
        {log || "waiting for output…"}
      </pre>
    </Drawer>
  );
}
