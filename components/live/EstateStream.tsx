"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * EstateStream — realtime hydration for authenticated screens via Server-Sent Events.
 *
 * Subscribes to /api/estate/stream (Postgres LISTEN/NOTIFY → SSE). The instant a sync
 * writes — the scheduled Fargate task or a manual /api/sync — every open screen
 * re-streams its RSC payload in place (`router.refresh()`): no reload, no spinner.
 *
 * Realtime is strictly additive. A gentle fallback interval + a focus/visibility
 * refresh remain as a safety net, so if the stream stalls, drops, or the browser
 * lacks EventSource, screens still stay current — never worse than plain polling.
 * A short cooldown collapses a burst (stream event next to a focus tick) into one
 * refresh, and everything pauses while the tab is hidden.
 */
export function EstateStream({
  /** Safety-net cadence used when the stream is quiet. */
  fallbackMs = 45_000,
}: {
  fallbackMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let lastRefresh = 0;
    const cooldownMs = 4_000;

    const refresh = () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return; // paused while hidden
      const now = Date.now();
      if (now - lastRefresh < cooldownMs) return; // collapse bursts
      lastRefresh = now;
      router.refresh();
    };

    // 1. Primary path: Server-Sent Events push.
    let es: EventSource | null = null;
    const openStream = () => {
      if (es || typeof EventSource === "undefined") return;
      try {
        es = new EventSource("/api/estate/stream");
        // `estate` events fire on every write; EventSource auto-reconnects on drops.
        es.addEventListener("estate", refresh);
      } catch {
        es = null;
      }
    };
    const closeStream = () => {
      es?.close();
      es = null;
    };
    openStream();

    // 2. Safety net: a slow interval + focus/visibility refresh.
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(refresh, fallbackMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
        openStream(); // re-open the stream if it was closed while hidden
      } else {
        stop();
        closeStream(); // no need to hold the stream in the background
      }
    };
    const onFocus = () => refresh();

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      stop();
      closeStream();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, fallbackMs]);

  return null;
}
