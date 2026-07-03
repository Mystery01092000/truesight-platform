import { cn } from "@/lib/utils/cn";
import type { CloudProvider } from "@/lib/taxonomy";

/**
 * ProviderChip — a small tinted glyph + label that identifies which cloud
 * provider a resource belongs to. The accent color is confined to the chip
 * glyph ONLY (a tiny square or dot), never to chrome text or borders, per the
 * system's discipline. This is the second surface (after AppIconTile) where
 * saturated accent is permitted.
 *
 * Provider brand hues (FROM FRONTEND-CURATION §1.5):
 *   AWS    #FF9900
 *   Azure  #0078D4
 *   GitHub neutral (monochrome)
 *   Terraform #7B42BC
 */
export const PROVIDER_HUE: Record<CloudProvider, string> = {
  aws: "#FF9900",
  azure: "#0078D4",
  github: "#c9d1d9",
  terraform: "#7B42BC",
};

export const PROVIDER_LABEL: Record<CloudProvider, string> = {
  aws: "AWS",
  azure: "Azure",
  github: "GitHub",
  terraform: "Terraform",
};

export type ProviderChipProps = {
  provider: CloudProvider;
  /** Show the label text alongside the dot (default true). */
  label?: boolean;
  className?: string;
};

export function ProviderChip({ provider, label = true, className }: ProviderChipProps) {
  const hue = PROVIDER_HUE[provider];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-micro font-medium leading-[1.4] tracking-[0.04em]",
        "bg-surface-elevated text-mute",
        className,
      )}
    >
      <span
        className="size-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: hue }}
        aria-hidden
      />
      {label ? PROVIDER_LABEL[provider] : null}
    </span>
  );
}
