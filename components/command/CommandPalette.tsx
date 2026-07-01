"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, Clock } from "lucide-react";
import { COMMAND_ROUTES } from "@/lib/nav";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";

/**
 * "Ask Argus" — the ⌘K command palette that IS the primary navigation metaphor
 * (Raycast-native). Guided self-discovery: quick-nav + suggestion prompts, not a
 * blank search box. Opens on ⌘K / Ctrl-K.
 */
// Only working routes — grows as pillars ship (cost/security later).
const SUGGESTIONS = [
  { label: "Trace a service's dependencies", href: "/topology" },
  { label: "Browse the AWS estate", href: "/aws" },
  { label: "Browse the Azure estate", href: "/azure" },
  { label: "See the org's top contributors", href: "/github" },
  { label: "Estate overview", href: "/overview" },
];

const ALL_DESTINATIONS = [
  ...COMMAND_ROUTES.map((r) => ({ href: r.href, label: r.label })),
  ...SUGGESTIONS,
];
const labelFor = (href: string) =>
  ALL_DESTINATIONS.find((d) => d.href === href)?.label ?? href;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // Recents persist across sessions (localStorage) — survive reload + re-login.
  const [recent, setRecent] = usePersistedState<string[]>("argus:recent-routes", []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setRecent((prev) => [href, ...prev.filter((h) => h !== href)].slice(0, 5));
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[16vh]"
      onClick={() => setOpen(false)}
    >
      <Command
        label="Ask Argus"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-hairline bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3">
          <Search size={16} className="text-mute" />
          <Command.Input
            autoFocus
            placeholder="Ask Argus or jump to…"
            className="h-11 w-full bg-transparent text-[16px] text-on-dark placeholder:text-ash focus:outline-none"
          />
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-[14px] text-mute">
            No matches. Try a resource, account, or pillar name.
          </Command.Empty>
          {recent.length > 0 && (
            <Command.Group
              heading="Recent"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ash"
            >
              {recent.map((href) => (
                <Command.Item
                  key={`recent-${href}`}
                  value={`recent ${labelFor(href)}`}
                  onSelect={() => go(href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[14px] text-body data-[selected=true]:bg-surface-card data-[selected=true]:text-on-dark"
                >
                  <Clock size={16} className="text-mute" />
                  {labelFor(href)}
                </Command.Item>
              ))}
            </Command.Group>
          )}
          <Command.Group
            heading="Go to"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ash"
          >
            {COMMAND_ROUTES.map((r) => {
              const Icon = r.icon;
              return (
                <Command.Item
                  key={r.href}
                  value={r.label}
                  onSelect={() => go(r.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[14px] text-body data-[selected=true]:bg-surface-card data-[selected=true]:text-on-dark"
                >
                  <Icon size={16} className="text-mute" />
                  {r.label}
                </Command.Item>
              );
            })}
          </Command.Group>
          <Command.Group
            heading="Suggestions"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-ash"
          >
            {SUGGESTIONS.map((s) => (
              <Command.Item
                key={s.label}
                value={s.label}
                onSelect={() => go(s.href)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[14px] text-body data-[selected=true]:bg-surface-card data-[selected=true]:text-on-dark"
              >
                {s.label}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
