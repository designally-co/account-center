"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { IN_OUT, OUT, boxOffset, gsap, lastInputWasKeyboard, reducedMotion } from "./motion";

// A popup that grows out of the card it was opened from, and shrinks back into it when it closes (Buk, 2026-11-03:
// a team, then a person: "the small card going bigger into a big popup modal"; "use that effect in all possible
// way"; "use GSAP motion"). Used by Teams and People.
//
// The card carries data-grow="<growFrom>". The box that grows is the popup's panel, or, in a `stack` popup (a
// column of separate cards, Buk: "separated containers not inside one big container"), the child marked
// data-grow-target. Its words (data-grow-content) fade in once it has grown; the popup's other cards
// (data-grow-follow) rise in after it. While it is open, the page behind does not scroll, Escape closes it (unless
// a list or a confirmation inside it is open, which Escape closes first), Tab stays inside, and afterClose() says
// where focus goes after.
export function Popup({ open, growFrom, labelledBy, onClose, afterClose, className, stack = false, children }: {
  open: boolean;
  growFrom: string | null;       // the data-grow value of the card it grows out of
  labelledBy: string;            // the id of the popup's title
  onClose: () => void;
  afterClose?: () => void;       // runs once it has closed, for example to put focus back on the card
  className?: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(open);
  // While it shrinks away, it keeps showing what it showed.
  const kept = useRef<React.ReactNode>(children);
  if (open) kept.current = children;
  const growKey = useRef(growFrom);
  if (open) growKey.current = growFrom;
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const motion = useRef<gsap.core.Timeline | null>(null);
  const closeRef = useRef(onClose);
  const afterRef = useRef(afterClose);
  closeRef.current = onClose;
  afterRef.current = afterClose;

  const parts = () => {
    const p = panel.current!;
    const target = (stack ? p.querySelector<HTMLElement>("[data-grow-target]") : null) ?? p;
    const source = growKey.current
      ? [...document.querySelectorAll<HTMLElement>(`[data-grow="${CSS.escape(growKey.current)}"]`)].find((el) => !p.contains(el)) ?? null
      : null;
    return { target, source, content: target.querySelectorAll("[data-grow-content]"), follow: p.querySelectorAll("[data-grow-follow]") };
  };

  // Opening: the box starts as the card and grows into place; then its words, then the cards that follow.
  useLayoutEffect(() => {
    if (open && !shown) { setShown(true); return; }
    if (!open || !shown || !panel.current) return;
    motion.current?.kill();
    const { target, source, content, follow } = parts();
    const t = gsap.timeline();
    motion.current = t;
    if (backdrop.current) t.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, 0);
    const fromCard = source && !reducedMotion() && source.getBoundingClientRect().width > 0;
    if (source) source.style.visibility = "hidden";
    if (fromCard) {
      t.fromTo(target, { ...boxOffset(source, target), transformOrigin: "0 0" },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.62, ease: OUT, clearProps: "transform" }, 0);
      if (content.length) t.fromTo(content, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power1.out" }, 0.2);
    } else {
      t.fromTo(target, { opacity: 0, y: 10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: OUT, clearProps: "transform,opacity" }, 0);
    }
    if (follow.length) t.fromTo(follow, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.6, ease: OUT, stagger: 0.06, clearProps: "transform,opacity" }, 0.14);
    // Focus moves into the popup. Opened from the keyboard, it lands on Close (with its ring); opened with a mouse
    // or a finger, it lands on the popup itself, which shows no ring, and the next Tab reaches Close.
    t.call(() => {
      const close = panel.current?.querySelector<HTMLElement>(".popup-close");
      if (lastInputWasKeyboard() && close) close.focus({ preventScroll: true });
      else panel.current?.focus({ preventScroll: true });
    }, [], 0.05);
    // only on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown]);

  // Closing: the words go first, the cards that follow sink away, and the box shrinks back into its card.
  useLayoutEffect(() => {
    if (open || !shown || !panel.current) return;
    motion.current?.kill();
    const { target, source, content, follow } = parts();
    const t = gsap.timeline({
      onComplete: () => {
        if (source) {
          source.style.visibility = "";
          const words = source.querySelectorAll("[data-grow-content]");
          if (words.length) gsap.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: "power1.out" });
        }
        setShown(false);
        window.setTimeout(() => afterRef.current?.(), 20);
      },
    });
    motion.current = t;
    if (content.length) t.to(content, { opacity: 0, duration: 0.12, ease: "power1.in" }, 0);
    if (follow.length) t.to(follow, { opacity: 0, y: 18, duration: 0.22, ease: "power2.in", stagger: 0.03 }, 0);
    const toCard = source && !reducedMotion() && source.getBoundingClientRect().width > 0;
    if (toCard) t.to(target, { ...boxOffset(source, target), transformOrigin: "0 0", duration: 0.48, ease: IN_OUT }, 0.06);
    else t.to(target, { opacity: 0, y: 8, scale: 0.97, duration: 0.2, ease: "power2.in" }, 0);
    if (backdrop.current) t.to(backdrop.current, { opacity: 0, duration: 0.32, ease: "power2.inOut" }, 0.1);
    // only on closing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // While it is shown: no page scroll behind, Escape and Tab.
  useLayoutEffect(() => {
    if (!shown) return;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector("dialog[open]") || document.querySelector(":popover-open")) return;
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.offsetParent !== null && !el.closest("dialog:not([open])"));
        if (!items.length) return;
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = body;
      document.removeEventListener("keydown", onKey);
    };
  }, [shown]);

  if (!shown) return null;
  const body = open ? children : kept.current;
  return stack ? (
    <div className="popup-stack-layer">
      <div ref={backdrop} className="popup-stack-backdrop" onClick={onClose} />
      <div ref={panel} className={`popup-stack${className ? ` ${className}` : ""}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {body}
      </div>
    </div>
  ) : (
    <div className="team-modal-layer">
      <div ref={backdrop} className="team-modal-backdrop" onClick={onClose} />
      <div ref={panel} className={`team-modal${className ? ` ${className}` : ""}`} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="team-modal-body" data-grow-content>
          <button type="button" className="icon-button team-modal-close popup-close" aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
          {body}
        </div>
      </div>
    </div>
  );
}
