import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Footer } from "@/components/nav/Footer";
import { buttonClass } from "@/components/ui/Button";

/**
 * Marketing shell — sticky monochrome top nav (Logo + Sign in + the one white
 * "Enter Argus" CTA), the page content, and the minimal footer. The nav bar is
 * the only chrome; everything load-bearing lives in the page itself.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-6">
          <Link href="/" aria-label="Argus home" className="inline-flex">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link href="/login" className={buttonClass("secondary", "md")}>
              Sign in
            </Link>
            <Link href="/login" className={buttonClass("primary", "md")}>
              Enter Argus
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer>
        <Link href="/login" className="transition-colors hover:text-on-dark">
          Sign in
        </Link>
        <span className="text-stone">Multi-cloud · AWS · Azure</span>
      </Footer>
    </div>
  );
}
