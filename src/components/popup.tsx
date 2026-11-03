"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

// A popup that grows out of the card it was opened from (Buk, 2026-11-03: a team, then a person: "the small card
// going bigger into a big popup modal"). The card and the popup share one framer-motion layoutId, so pressing
// the card grows that card into the popup, and closing shrinks it back into its place. Used by Teams and People.
//
// While it is open: the page behind does not scroll, Escape closes it (unless a list or a confirmation inside
// it is open, which Escape closes first), Tab stays inside, and afterFocus() says where focus goes after it.
export const GROW = { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.9 };

export function Popup({ open, layoutId, labelledBy, onClose, afterClose, className, children }: {
  open: boolean;
  layoutId: string;              // the same id as the card it grows out of
  labelledBy: string;            // the id of the popup's title
  onClose: () => void;
  afterClose?: () => void;       // runs once it has closed, for example to put focus back on the card
  className?: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const afterRef = useRef(afterClose);
  closeRef.current = onClose;
  afterRef.current = afterClose;

  useEffect(() => {
    if (!open) return;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = window.setTimeout(() => panel.current?.querySelector<HTMLElement>(".popup-close")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector("dialog[open]") || panel.current?.querySelector('.pik-pill[aria-expanded="true"]')) return;
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = body;
      window.clearTimeout(first);
      document.removeEventListener("keydown", onKey);
      window.setTimeout(() => afterRef.current?.(), 40);
    };
  }, [open, layoutId]);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <div className="team-modal-layer" key="popup">
          <motion.div className="team-modal-backdrop" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div ref={panel} layoutId={layoutId} transition={GROW} className={`team-modal${className ? ` ${className}` : ""}`}
            role="dialog" aria-modal="true" aria-labelledby={labelledBy} style={{ borderRadius: 16 }}>
            {/* The words arrive once the box has grown, so they are never seen stretched. */}
            <motion.div className="team-modal-body"
              initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.14 } }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}>
              <button type="button" className="icon-button team-modal-close popup-close" aria-label="Close" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
              {children}
            </motion.div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
