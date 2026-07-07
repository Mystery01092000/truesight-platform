import Link from "next/link";
import { Providers } from "@/app/providers";
import { Logo } from "@/components/brand/Logo";
import { Footer } from "@/components/nav/Footer";
import { buttonClass } from "@/components/ui/Button";

/**
 * Marketing shell — sticky monochrome top nav (Logo + the single "Sign in" CTA),
 * the page content, and the minimal footer. The nav bar is the only chrome;
 * everything load-bearing lives in the page itself. There is exactly one sign-in
 * affordance: it scrolls to the hero login form at `#signin` (the LoginForm wires
 * up smooth scroll + email focus for every `#signin` anchor on the page).
 *
 * Wrapped in `Providers` so the hero dashboard can pull live `/api/landing-stats`
 * through TanStack Query, matching the authenticated shell's data layer.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between px-6">
            <Link href="/" aria-label="Truesight home" className="inline-flex">
              <Logo />
            </Link>
            <nav className="flex items-center gap-1.5">
              <a href="#signin" className={buttonClass("primary", "md")}>
                Sign in
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <Footer>
          <a href="#signin" className="transition-colors hover:text-on-dark">
            Sign in
          </a>
          <span className="text-stone">Multi-cloud · AWS · Azure</span>
        </Footer>
      </div>
    </Providers>
  );
}
