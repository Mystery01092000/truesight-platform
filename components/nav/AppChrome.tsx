"use client";

import { usePathname } from "next/navigation";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { Sidebar } from "@/components/nav/Sidebar";
import { TopBar } from "@/components/nav/TopBar";
import { Keycap } from "@/components/ui/Keycap";
import { CommandPalette } from "@/components/command/CommandPalette";
import { CapabilityPane } from "@/components/capabilities/CapabilityPane";
import { useCapabilities } from "@/components/capabilities/CapabilityProvider";
import { capabilityForRoute } from "@/lib/capabilities";
import { NAV_ITEMS } from "@/lib/nav";
import { logoutAction } from "@/app/(app)/actions";

export function AppChrome({
  user,
  children,
}: {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isOn, setPaneOpen } = useCapabilities();
  // Curated-off capabilities drop out of the nav; the estate core always stays.
  const items = NAV_ITEMS.filter((i) => {
    const cap = capabilityForRoute(i.href);
    return cap == null || isOn(cap);
  });
  // Breadcrumb resolves against the full list so a directly-visited route still names itself.
  const active = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar items={items} activeHref={active?.href} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumb={<span className="text-on-dark">{active?.label ?? "Truesight"}</span>}
        >
          <button
            type="button"
            onClick={() => setPaneOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-micro text-mute transition-colors hover:bg-surface-elevated hover:text-on-dark"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Curate view</span>
          </button>
          <span className="hidden items-center gap-1 text-[12px] text-mute sm:inline-flex">
            <Keycap>⌘</Keycap>
            <Keycap>K</Keycap>
          </span>
          <span className="hidden text-label text-mute md:inline">{user.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-label text-body transition-colors hover:bg-surface-elevated hover:text-on-dark"
            >
              <LogOut size={15} />
            </button>
          </form>
        </TopBar>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
      <CapabilityPane />
      <CommandPalette />
    </div>
  );
}
