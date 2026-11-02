"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// A thin line under the bar that starts the moment a link is clicked and finishes when the next page is on
// screen, so a click never looks ignored, even when the server is slow (Buk, 2026-11-02: "I clicked a button
// and I need to wait too long").
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  const here = `${path}?${search.toString()}`;
  const last = useRef(here);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      window.clearTimeout(timer.current);
      setState("busy");
      timer.current = window.setTimeout(() => setState("idle"), 15000);  // never stay forever
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (last.current === here) return;
    last.current = here;
    window.clearTimeout(timer.current);
    setState((s) => (s === "busy" ? "done" : s));
    timer.current = window.setTimeout(() => setState("idle"), 400);
  }, [here]);

  return <span className={`nav-progress ${state}`} aria-hidden="true" />;
}
