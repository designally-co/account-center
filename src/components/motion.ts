"use client";

import gsap from "gsap";
import { Flip } from "gsap/Flip";

// The app's motion runs on GSAP and its Flip plugin (Buk, 2026-11-03: "use GSAP motion"; "every transition must
// have smooth animation"). GSAP is free to use, also commercially, under its standard licence.
gsap.registerPlugin(Flip);

export { gsap, Flip };

// One family of eases, so everything moves alike: things grow out fast and settle softly; things that move
// between two places start and end softly.
export const OUT = "expo.out";
export const IN_OUT = "power3.inOut";

export function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// How far `from`'s box lies from `to`'s, as a transform on `to` (moved and scaled from its top left corner).
export function boxOffset(from: Element, to: Element) {
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, scaleX: a.width / Math.max(b.width, 1), scaleY: a.height / Math.max(b.height, 1) };
}

// Close a <dialog> softly: it fades and sinks a little, then closes. Use it instead of dialog.close().
export function closeDialog(dialog: HTMLDialogElement | null | undefined) {
  if (!dialog?.open) return;
  if (reducedMotion()) { dialog.close(); return; }
  gsap.to(dialog, {
    opacity: 0, y: 6, scale: 0.97, duration: 0.18, ease: "power2.in",
    onComplete: () => { dialog.close(); gsap.set(dialog, { clearProps: "opacity,transform" }); },
  });
}

// Whether the last thing the person did was a key press (not a click or a tap), so a popup knows whether to show
// a focus ring on what it focuses.
let keyboard = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => { if (!e.metaKey && !e.ctrlKey) keyboard = true; }, true);
  window.addEventListener("pointerdown", () => { keyboard = false; }, true);
}
export function lastInputWasKeyboard() { return keyboard; }
