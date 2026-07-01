"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { Sidebar } from "@/components/nav/Sidebar";
import { TopBar } from "@/components/nav/TopBar";
import { Keycap } from "@/components/ui/Keycap";
import { CommandPalette } from "@/components/command/CommandPalette";
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
  const active = NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <Sidebar items={[...NAV_ITEMS]} activeHref={active?.href} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumb={<span className="text-on-dark">{active?.label ?? "Argus"}</span>}
        >
          <span className="hidden items-center gap-1 text-[12px] text-mute sm:inline-flex">
            <Keycap>⌘</Keycap>
            <Keycap>K</Keycap>
          </span>
          <span className="hidden text-[13px] text-mute md:inline">{user.name}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-body transition-colors hover:bg-surface-elevated hover:text-on-dark"
            >
              <LogOut size={15} />
            </button>
          </form>
        </TopBar>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
