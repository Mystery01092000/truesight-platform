"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SSR-safe cross-session UI state. The first client render uses `initial` (matching
 * the server), so hydration never mismatches; the persisted value is read from
 * localStorage AFTER mount and applied, then written back on every change. Use for
 * filters, grouping, recents, sidebar prefs — anything that should survive a reload
 * or a new session.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const hydrated = useRef(false);

  // Load persisted value once, after mount (post-hydration).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* corrupt/unavailable storage — fall back to initial */
    }
    hydrated.current = true;
  }, [key]);

  // Persist on change (only after the initial load, so we don't clobber storage).
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full/blocked — non-fatal */
    }
  }, [key, value]);

  return [value, setValue];
}
