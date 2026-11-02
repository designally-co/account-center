"use client";

import { useEffect, useRef, useState } from "react";

// Copies a short text (a shared login email) and says so for a moment: the icon turns into a tick.
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;  // no clipboard (an old browser or a blocked page): the email stays on screen to copy by hand
    }
    setDone(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  }

  return (
    <button type="button" className={`copy${done ? " done" : ""}`} onClick={copy} aria-label={done ? "Copied" : label}>
      <span className="copy-icon" aria-hidden="true">
        <svg className="copy-sheets" width="16" height="16" viewBox="0 0 16 16"><rect x="5.5" y="5.5" width="8" height="8" rx="1.8" /><path d="M10.5 3.6V3.3A1.3 1.3 0 0 0 9.2 2H3.3A1.3 1.3 0 0 0 2 3.3v5.9a1.3 1.3 0 0 0 1.3 1.3h.3" /></svg>
        <svg className="copy-tick" width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 8.4l2.9 2.9 6.1-6.6" /></svg>
      </span>
      <span className="copy-text">{done ? "Copied" : "Copy"}</span>
    </button>
  );
}
