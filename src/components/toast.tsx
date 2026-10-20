"use client";

import { useEffect, useState } from "react";

// Toasts: a short success message that appears at the bottom of the screen and goes away by itself
// (Buk, 2026-10-19: "do not use the status like this, use toast"). Errors stay next to the problem.
// One live region for the whole app, so screen readers announce every toast.

type Item = { id: number; text: string };
const SHOW_MS = 4000;
let show: ((text: string) => void) | null = null;
const waiting: string[] = [];
let next = 0;

export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    show = (text) => {
      const id = ++next;
      setItems((list) => [...list.slice(-2), { id, text }]);
      window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), SHOW_MS);
    };
    waiting.splice(0).forEach((text) => show?.(text));
    return () => { show = null; };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.3l2.8 2.8 6.2-6.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// Shows its text as a toast once, when it appears. A message that came in the address (?notice=...) is
// taken out of it, so reloading the page does not show it again.
export function Toast({ text }: { text: string }) {
  useEffect(() => {
    if (show) show(text); else waiting.push(text);
    const url = new URL(window.location.href);
    if (url.searchParams.has("notice")) {
      url.searchParams.delete("notice");
      window.history.replaceState(window.history.state, "", url);
    }
  }, [text]);
  return null;
}
