"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Drawer — the right-side detail sheet. Slides in over a scrim (250ms, the
 * system ease), portals to <body>, locks body scroll and traps focus while
 * open, and returns focus on close (Esc or scrim click also close). The panel
 * is the one sanctioned floating surface: it wears shadow-overlay to separate
 * from the ladder below.
 */
export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Panel width in px (default 480; clamps to the viewport). */
  width?: number;
  children: React.ReactNode;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({ open, onClose, title, width = 480, children, className }: DrawerProps) {
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  // Portal target only exists client-side; render nothing during SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Manual focus trap: cycle Tab within the panel's focusables.
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-scrim"
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: reduced ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: `min(${width}px, 100vw)` }}
            className={cn(
              "absolute inset-y-0 right-0 flex flex-col border-l border-hairline bg-surface shadow-overlay focus:outline-none",
              className,
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
              {title ? (
                <h2 className="text-[16px] font-medium leading-[1.4] text-ink">{title}</h2>
              ) : (
                <span aria-hidden />
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-sm p-1.5 text-mute transition-colors duration-150 ease-smooth hover:bg-surface-elevated hover:text-on-dark"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
