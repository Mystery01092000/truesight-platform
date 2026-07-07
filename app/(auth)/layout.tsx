import { WatcherScene } from "@/components/brand/WatcherScene";

/**
 * Auth shell — the sign-in card floats over the ambient WatcherScene (the Truesight
 * aperture watching a live cross-cloud estate), so /login is visual-driven and
 * cinematic rather than a bare card on flat canvas. A vertical canvas gradient
 * keeps the card fully legible over the field, and a line of brand poetry closes
 * the moment.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-16">
      {/* Cinematic backdrop — the watcher, behind the sign-in */}
      <WatcherScene />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-canvas/55 via-canvas/25 to-canvas/75" />

      <div className="relative z-10 flex w-full flex-col items-center gap-7">
        {children}
        <p className="max-w-xs text-center text-[12px] leading-[1.6] tracking-[0.3px] text-stone">
          True sight over your estate. Nothing goes unseen.
        </p>
      </div>
    </div>
  );
}
