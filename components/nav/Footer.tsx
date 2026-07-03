import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/brand/Logo";

/**
 * Footer — minimal chrome close. A single hairline top rule over the canvas,
 * the Argus mark, attribution, and an optional link slot. Monochrome, quiet.
 */
export type FooterProps = {
  children?: React.ReactNode;
  className?: string;
};

export function Footer({ children, className }: FooterProps) {
  return (
    <footer className={cn("border-t border-hairline bg-canvas", className)}>
      <div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <Logo size={20} />
          <p className="text-label leading-[1.4] text-mute">
            Cloud governance with no blind spots.
          </p>
        </div>

        {children && (
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-mute">
            {children}
          </nav>
        )}

        <p className="text-label leading-[1.4] text-stone">
          © {new Date().getFullYear()} CentricityWealthTech
        </p>
      </div>
    </footer>
  );
}
