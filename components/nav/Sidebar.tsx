import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/brand/Logo";

/**
 * Sidebar — presentational vertical nav for the authed app chrome. Items are
 * passed in; no auth or routing logic lives here. Hairline right rule, Logo
 * anchored at the top. Active rows lift one surface notch (surface-elevated).
 */
export type SidebarItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

export type SidebarProps = {
  items: SidebarItem[];
  activeHref?: string;
  className?: string;
  footer?: React.ReactNode;
};

export function Sidebar({ items, activeHref, className, footer }: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-dvh w-60 shrink-0 flex-col border-r border-hairline bg-canvas",
        className,
      )}
    >
      <div className="px-4 py-4">
        <Link href="/" aria-label="Argus home" className="inline-flex">
          <Logo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
        {items.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px] leading-[1.6] transition-colors",
                active
                  ? "bg-surface-elevated text-on-dark"
                  : "text-body hover:bg-surface-elevated hover:text-on-dark",
              )}
            >
              {Icon && <Icon size={18} className="shrink-0" />}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {footer && <div className="border-t border-hairline px-3 py-3">{footer}</div>}
    </aside>
  );
}
