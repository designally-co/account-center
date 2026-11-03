"use client";

import { useEffect } from "react";
import { closeDialog } from "./motion";

// Every window (<dialog>) in the app closes softly on Escape too, the same as on its own buttons (Buk, 2026-11-03:
// "every transition must have smooth animation"). The browser would close it at once; this takes over.
export function DialogMotion() {
  useEffect(() => {
    const onCancel = (e: Event) => {
      const d = e.target;
      if (!(d instanceof HTMLDialogElement) || !d.classList.contains("modal")) return;
      e.preventDefault();
      closeDialog(d);
    };
    document.addEventListener("cancel", onCancel, true);
    return () => document.removeEventListener("cancel", onCancel, true);
  }, []);
  return null;
}
