"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
import { CAPABILITIES, CAPABILITY_STORAGE_KEY, type CapabilityKey } from "@/lib/capabilities";

/**
 * Session-level capability curation, shared via context (precedent:
 * components/topology/focus.ts). SSR and the first client render use the
 * all-on default so hydration never mismatches; stored preferences apply
 * after mount as one clean, non-animated swap. Presentation only — whatever
 * the viewer's role protects stays protected server-side.
 */

const ALL_ON = Object.fromEntries(CAPABILITIES.map((k) => [k, true])) as Record<
  CapabilityKey,
  boolean
>;

export type CapabilityContextValue = {
  enabled: Record<CapabilityKey, boolean>;
  isOn: (key: CapabilityKey) => boolean;
  toggle: (key: CapabilityKey) => void;
  allOn: boolean;
  paneOpen: boolean;
  setPaneOpen: (open: boolean) => void;
  hintDismissed: boolean;
  dismissHint: () => void;
};

const CapabilityContext = createContext<CapabilityContextValue>({
  enabled: ALL_ON,
  isOn: () => true,
  toggle: () => {},
  allOn: true,
  paneOpen: false,
  setPaneOpen: () => {},
  hintDismissed: true,
  dismissHint: () => {},
});

export function useCapabilities() {
  return useContext(CapabilityContext);
}

export function CapabilityProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = usePersistedState<Record<CapabilityKey, boolean>>(
    CAPABILITY_STORAGE_KEY,
    ALL_ON,
  );
  const [hintDismissed, setHintDismissed] = usePersistedState<boolean>(
    "argus.capabilities.hint.v1",
    false,
  );
  const [paneOpen, setPaneOpen] = useState(false);

  const value = useMemo<CapabilityContextValue>(() => {
    // Missing keys (older persisted shapes) default to on.
    const isOn = (key: CapabilityKey) => enabled[key] !== false;
    return {
      enabled,
      isOn,
      toggle: (key) => {
        setEnabled((prev) => ({ ...prev, [key]: prev[key] === false }));
        setHintDismissed(true);
      },
      allOn: CAPABILITIES.every(isOn),
      paneOpen,
      setPaneOpen,
      hintDismissed,
      dismissHint: () => setHintDismissed(true),
    };
  }, [enabled, paneOpen, hintDismissed, setEnabled, setHintDismissed]);

  return <CapabilityContext.Provider value={value}>{children}</CapabilityContext.Provider>;
}
