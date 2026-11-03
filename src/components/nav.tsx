"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { House, KeyRound, LogOut, Lock, Network, UserRound, Users, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/access";
import { Avatar } from "./avatar";
import { Mark } from "./mark";
import { NavProgress } from "./nav-progress";

type Item = { href: string; label: string; icon: LucideIcon; admin: boolean };
const ITEMS: Item[] = [
  { href: "/", label: "Home", icon: House, admin: false },
  { href: "/people", label: "People", icon: Users, admin: true },
  { href: "/teams", label: "Teams", icon: Network, admin: false },
  { href: "/subscriptions", label: "Subscriptions", icon: KeyRound, admin: false },
];

function isCurrent(href: string, path: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

// The signed-in pages' navigation: a slim rail of icons on the left instead of a bar on top (Buk, 2026-11-03,
// after an app whose sidebar is icons only, with a dark label and a shortcut on hover). The mark is at the top;
// the pages and your avatar sit in the middle. The soft square behind the current page slides to the next
// one. Pointing at an icon shows its name and its key (Alt or ⌥ with 1 to 4). Your avatar opens your menu.
// On a phone the same icons are a bar along the bottom, where a thumb reaches them. People is shown only to
// those who may see it; Teams and Subscriptions to everyone, with their settings for admins only (Buk,
// 2026-11-03). The pages check again on the server.
export function Nav({ me, canView }: { me: Me; canView: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const items = ITEMS.filter((i) => canView || !i.admin);
  const list = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [mod, setMod] = useState("Alt ");

  // Mac keyboards call the key ⌥.
  useEffect(() => { if (/Mac|iPhone|iPad/.test(navigator.platform)) setMod("⌥"); }, []);

  // Measured again when the rail changes size (the window, a phone turning it into a bottom bar).
  useLayoutEffect(() => {
    const place = () => {
      const el = list.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setPill(el && el.offsetWidth ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    place();
    const watch = new ResizeObserver(place);
    if (list.current) watch.observe(list.current);
    return () => watch.disconnect();
  }, [path, canView]);

  // Alt (⌥) with a number opens a page, unless the person is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey || !/^Digit[1-9]$/.test(e.code)) return;
      if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
      const item = items[Number(e.code.slice(5)) - 1];
      if (!item) return;
      e.preventDefault();
      router.push(item.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, router]);

  // The menu opens beside your avatar on a computer, and above it on a phone.
  const placeMenu = (button: HTMLElement) => {
    const m = menu.current;
    if (!m) return;
    const r = button.getBoundingClientRect();
    const phone = window.matchMedia("(max-width: 720px)").matches;
    Object.assign(m.style, phone
      ? { left: "auto", top: "auto", right: "8px", bottom: `${Math.round(window.innerHeight - r.top + 8)}px` }
      : { right: "auto", bottom: "auto", left: `${Math.round((button.closest(".rail")?.getBoundingClientRect().right ?? r.right) + 10)}px`, top: `${Math.round(Math.max(12, Math.min(r.top - 8, window.innerHeight - 220)))}px` });
  };
  const closeMenu = () => menu.current?.hidePopover?.();

  return (
    <>
      <Suspense fallback={null}><NavProgress /></Suspense>
      <nav className="rail" aria-label="Account Center">
        <Link href="/" className="rail-mark" aria-label="Account Center, Home"><Mark size={30} /></Link>
        <div className="rail-items" ref={list}>
          {pill ? <span className="rail-pill" aria-hidden="true" style={{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h }} /> : null}
          {items.map((item, n) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="rail-item" aria-label={item.label}
                aria-current={isCurrent(item.href, path) ? "page" : undefined} aria-keyshortcuts={`Alt+${n + 1}`}>
                <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                <span className="rail-tip" aria-hidden="true">{item.label}<kbd>{mod}{n + 1}</kbd></span>
              </Link>
            );
          })}
          <button type="button" className="rail-item rail-avatar" popoverTarget="account-menu" aria-label={`Your account: ${me.display_name}`}
            onClick={(e) => placeMenu(e.currentTarget)}>
            <Avatar avatar={me.avatar} seed={me.person_id} size={34} />
            <span className="rail-tip" aria-hidden="true">{me.display_name}</span>
          </button>
        </div>
        <div id="account-menu" popover="auto" className="menu" ref={menu}>
          <div className="menu-head">
            <Avatar avatar={me.avatar} seed={me.person_id} size={40} />
            <strong>{me.display_name}</strong>
          </div>
          <Link href="/avatar" className="menu-item" onClick={closeMenu}>
            <UserRound size={16} strokeWidth={1.6} aria-hidden="true" />
            Your avatar
          </Link>
          <Link href="/password" className="menu-item" onClick={closeMenu}>
            <Lock size={16} strokeWidth={1.6} aria-hidden="true" />
            Change password
          </Link>
          <form action={signOut}>
            <button type="submit" className="menu-item">
              <LogOut size={16} strokeWidth={1.6} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
