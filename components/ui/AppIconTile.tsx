import * as LucideIcons from "lucide-react";
import { Box, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { kindAccent, kindIcon, type ResourceKind } from "@/lib/taxonomy";

/**
 * AppIconTile — the ONE surface where saturated accent is allowed. A resource
 * kind's lucide glyph sits on a surface-card tile, tinted by its taxonomy
 * accent (a soft 15% wash + accent-colored icon). Everywhere else stays
 * monochrome. Accent is confined to this tile by design.
 */
const ICON_SET = LucideIcons as unknown as Record<string, LucideIcon | undefined>;

type AccentToken = "accent-blue" | "accent-green" | "accent-red" | "accent-yellow" | "mute";

const ACCENT_ICON: Record<AccentToken, string> = {
  "accent-blue": "text-accent-blue",
  "accent-green": "text-accent-green",
  "accent-red": "text-accent-red",
  "accent-yellow": "text-accent-yellow",
  mute: "text-mute",
};

const ACCENT_TINT: Record<AccentToken, string> = {
  "accent-blue": "bg-accent-blue-soft",
  "accent-green": "bg-accent-green-soft",
  "accent-red": "bg-accent-red-soft",
  "accent-yellow": "bg-accent-yellow-soft",
  mute: "bg-transparent",
};

/** Resolve a lucide icon name (PascalCase, kebab-case, or camelCase) to a component. */
function resolveIcon(name: string | undefined): LucideIcon {
  if (name) {
    if (ICON_SET[name]) return ICON_SET[name] as LucideIcon;
    const pascal = name
      .replace(/(^\w|[-_\s]\w)/g, (m) => m.replace(/[-_\s]/, "").toUpperCase())
      .replace(/^./, (c) => c.toUpperCase());
    if (ICON_SET[pascal]) return ICON_SET[pascal] as LucideIcon;
  }
  return Box;
}

export type AppIconTileProps = {
  kind: ResourceKind;
  size?: 48 | 64;
  className?: string;
};

export function AppIconTile({ kind, size = 48, className }: AppIconTileProps) {
  const accent = (kindAccent[kind] ?? "mute") as AccentToken;
  const Icon = resolveIcon(kindIcon[kind]);
  const iconPx = size === 64 ? 26 : 22;

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-md border border-hairline bg-surface-card",
        "transition duration-200 ease-smooth group-hover:border-hairline-strong",
        size === 64 ? "size-16" : "size-12",
        className,
      )}
    >
      <span className={cn("absolute inset-0", ACCENT_TINT[accent])} aria-hidden />
      <Icon size={iconPx} strokeWidth={1.75} className={cn("relative", ACCENT_ICON[accent])} />
    </div>
  );
}
