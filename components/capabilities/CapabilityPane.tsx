"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { useCapabilities } from "@/components/capabilities/CapabilityProvider";
import { CAPABILITIES, CAPABILITY_META } from "@/lib/capabilities";
import { cn } from "@/lib/utils/cn";

/**
 * CapabilityPane — the "Curate this view" drawer. One switch row per
 * capability; toggles apply instantly and persist for the session's browser.
 * Calm, matter-of-fact copy: this curates presentation, it never guards data.
 */

function CapabilitySwitch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Show ${label}`}
      onClick={onToggle}
      className={cn(
        "relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-150 ease-smooth",
        on ? "border-primary bg-primary" : "border-hairline-strong bg-surface-elevated",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 size-3 -translate-y-1/2 rounded-full transition-transform duration-150 ease-smooth",
          on ? "translate-x-[15px] bg-on-primary" : "translate-x-[3px] bg-mute",
        )}
      />
    </button>
  );
}

export function CapabilityPane() {
  const { enabled, toggle, paneOpen, setPaneOpen } = useCapabilities();

  return (
    <Drawer open={paneOpen} onClose={() => setPaneOpen(false)} title="Curate this view" width={400}>
      <p className="text-label leading-[1.5] text-mute">Choose what this session shows.</p>
      <ul className="mt-5">
        {CAPABILITIES.map((key) => {
          const meta = CAPABILITY_META[key];
          return (
            <li
              key={key}
              className="flex items-center justify-between gap-4 border-b border-hairline-soft py-3.5 first:pt-0 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-[14px] font-medium leading-[1.5] text-ink">{meta.label}</p>
                <p className="mt-0.5 text-[12px] leading-[1.5] text-mute">{meta.description}</p>
              </div>
              <CapabilitySwitch
                on={enabled[key] !== false}
                onToggle={() => toggle(key)}
                label={meta.label}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-6 border-t border-hairline pt-4 text-[12px] leading-[1.5] text-ash">
        Hidden here, still protected by your role.
      </p>
    </Drawer>
  );
}

/**
 * One-line dismissible hint pointing at the Curate view control. Shows until
 * the viewer dismisses it or customizes the view; renders post-mount only so
 * viewers who already dismissed never see it flash.
 */
export function CurateHint() {
  const { hintDismissed, dismissHint, setPaneOpen } = useCapabilities();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || hintDismissed) return null;

  return (
    <div className="-mt-4 mb-8 flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-3.5 py-2.5">
      <p className="text-label leading-[1.5] text-mute">
        You can choose what this session shows —{" "}
        <button
          type="button"
          onClick={() => setPaneOpen(true)}
          className="inline-flex items-baseline gap-1 text-body underline decoration-hairline-strong underline-offset-2 transition-colors duration-150 ease-smooth hover:text-on-dark hover:decoration-on-dark"
        >
          <SlidersHorizontal size={12} className="self-center" />
          Curate view
        </button>{" "}
        lives in the top bar.
      </p>
      <button
        type="button"
        onClick={dismissHint}
        aria-label="Dismiss"
        className="rounded-sm p-1 text-mute transition-colors duration-150 ease-smooth hover:bg-surface-elevated hover:text-on-dark"
      >
        <X size={14} />
      </button>
    </div>
  );
}
