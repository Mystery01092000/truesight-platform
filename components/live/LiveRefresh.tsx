"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * LiveRefresh — the realtime heartbeat for authenticated screens.
 *
 * Every RSC screen is `force-dynamic` + direct Drizzle (fresh per load), so a
 * `router.refresh()` re-streams the server payload in place: no full reload, no
 * spinner, no client cache to reconcile. Mounted once in the app shell, this
 * component keeps that payload current by refreshing on a gentle interval AND
 * whenever the tab regains focus.
 *
 * Restraint is the whole point:
 *  - it renders nothing;
 *  - it pauses entirely while the tab is hidden (no background churn);
 *  - it guards against overlapping/duplicate refreshes with a short cooldown,
 *    since `router.refresh()` is fire-and-forget and returns no promise.
 */
export function LiveRefresh({
  /** Base cadence between background refreshes. Prop-configurable; ~30s default. */
  intervalMs = 30_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    // Don't refresh more than once per cooldown window — collapses an interval
    // tick that lands next to a focus/visibility refresh into a single re-stream.
    const cooldownMs = Math.min(intervalMs, 8_000);
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastRefresh = 0;
    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return; // paused while hidden
      const now = Date.now();
      if (now - lastRefresh < cooldownMs) return; // overlap guard
      lastRefresh = now;
      router.refresh();
    };

    const start = () => {
      if (timer === null) timer = setInterval(refresh, intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh(); // catch up immediately on returning to the tab
        start();
      } else {
        stop(); // stop ticking in the background
      }
    };
    const onFocus = () => refresh();

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, intervalMs]);

  return null;
}
