"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/", label: "Home", admin: false },
  { href: "/people", label: "People", admin: true },
  { href: "/teams", label: "Teams", admin: true },
  { href: "/subscriptions", label: "Subscriptions", admin: true },
];

function isCurrent(href: string, path: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

// The page links. The soft highlight slides to the link you chose, because the bar stays while pages change.
export function NavLinks({ canView }: { canView: boolean }) {
  const path = usePathname();
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  const links = LINKS.filter((l) => canView || !l.admin);

  // Measured again when the links change size (the web font arriving, a narrower window, a phone hiding Home).
  useLayoutEffect(() => {
    const place = () => {
      const el = list.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setPill(el && el.offsetWidth ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    place();
    const watch = new ResizeObserver(place);
    list.current?.querySelectorAll("a").forEach((a) => watch.observe(a));
    document.fonts?.ready.then(place);
    return () => watch.disconnect();
  }, [path, canView]);

  return (
    <nav aria-label="Account Center" className="nav-links" ref={list}>
      {pill ? <span className="nav-pill" aria-hidden="true" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} /> : null}
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isCurrent(l.href, path) ? "page" : undefined}>{l.label}</Link>
      ))}
    </nav>
  );
}
