"use client";

import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

interface TfPreviewProps {
  open: boolean;
  planName: string;
  tf: Record<string, unknown> | null;
  hcl: string;
  onClose: () => void;
}

/** Generated-Terraform drawer: HCL / JSON tabs, copy and download. */
export function TfPreview({ open, planName, tf, hcl, onClose }: TfPreviewProps) {
  const [tab, setTab] = useState<"hcl" | "json">("hcl");
  const json = tf ? JSON.stringify(tf, null, 2) : "";
  const body = tab === "hcl" ? hcl : json;

  function download() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "main.tf.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Drawer open={open} onClose={onClose} title={`Terraform — ${planName}`} width={640}>
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="flex gap-1">
          {(["hcl", "json"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.5px] transition-colors",
                tab === t ? "bg-surface-card text-ink" : "text-mute hover:text-body",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard.writeText(body)}>
            <Copy size={13} strokeWidth={1.5} />
            Copy
          </Button>
          <Button variant="secondary" size="sm" onClick={download}>
            <Download size={13} strokeWidth={1.5} />
            main.tf.json
          </Button>
        </div>
      </div>
      <pre className="max-h-[75vh] overflow-auto rounded-lg border border-hairline bg-surface-base p-4 font-mono text-[12px] leading-[1.6] text-body">
        {body || "— nothing generated yet —"}
      </pre>
    </Drawer>
  );
}
