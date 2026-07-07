"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  planName: string;
  kind: "apply" | "destroy";
  onConfirm: () => void;
  onCancel: () => void;
}

/** Typed-name confirmation before terraform apply/destroy touches real clouds. */
export function ConfirmDialog({ open, planName, kind, onConfirm, onCancel }: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const verb = kind === "apply" ? "deploy" : "destroy";
  return (
    <Drawer open={open} onClose={onCancel} title={`Confirm ${verb}`} width={440}>
      <p className="text-[13px] leading-[1.6] text-body">
        This runs <code className="font-mono text-[12px] text-ink">terraform {kind} -auto-approve</code> against the
        real cloud accounts configured via the <code className="font-mono text-[12px]">DEPLOY_*</code> credentials.
        {kind === "destroy" ? " Every resource this plan created will be deleted." : ""}
      </p>
      <p className="mt-4 text-[12px] text-mute">
        Type <span className="font-mono text-ink">{planName}</span> to confirm.
      </p>
      <input
        autoFocus
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="mt-2 h-9 w-full rounded-md border border-hairline bg-surface-card px-3 font-mono text-[13px] text-ink outline-none focus:border-iris"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="tertiary" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          disabled={typed !== planName}
          onClick={() => {
            setTyped("");
            onConfirm();
          }}
        >
          {verb === "deploy" ? "Deploy" : "Destroy"}
        </Button>
      </div>
    </Drawer>
  );
}
