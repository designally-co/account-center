import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/access";
import { Avatar } from "./avatar";
import { Mark } from "./mark";
import { Suspense } from "react";
import { NavLinks } from "./nav-links";
import { NavProgress } from "./nav-progress";

// The bar at the top of every signed-in page. It lives in the shared layout, so it stays on screen while the
// next page loads, with a thin progress line under it. People, Teams and Subscriptions are shown only to
// those who may see them; the pages check again on the server. Your avatar opens a small menu: your avatar,
// your password, sign out (Buk, 2026-11-02: one row on a phone).
export function Nav({ me, canView }: { me: Me; canView: boolean }) {
  return (
    <header className="nav">
      <Link href="/" className="brand" aria-label="Account Center, Home"><Mark size={26} /><span className="brand-text">Account Center</span></Link>
      <NavLinks canView={canView} />
      <div className="who">
        <button type="button" className="who-button" popoverTarget="account-menu" aria-label={`Your account: ${me.display_name}`}>
          <Avatar avatar={me.avatar} seed={me.person_id} size={32} />
          <span className="who-name">{me.display_name}</span>
          <svg className="who-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div id="account-menu" popover="auto" className="menu">
          <div className="menu-head">
            <Avatar avatar={me.avatar} seed={me.person_id} size={40} />
            <strong>{me.display_name}</strong>
          </div>
          <Link href="/avatar" className="menu-item">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="6" r="2.6" /><path d="M3 13.2c.8-2.3 2.7-3.5 5-3.5s4.2 1.2 5 3.5" /></svg>
            Your avatar
          </Link>
          <Link href="/password" className="menu-item">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="6.5" rx="1.6" /><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" /></svg>
            Change password
          </Link>
          <form action={signOut}>
            <button type="submit" className="menu-item">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 3H4.2A1.2 1.2 0 0 0 3 4.2v7.6A1.2 1.2 0 0 0 4.2 13h2.3M10 5.2 12.8 8 10 10.8M12.6 8H6.5" /></svg>
              Sign out
            </button>
          </form>
        </div>
      </div>
      <Suspense fallback={null}><NavProgress /></Suspense>
    </header>
  );
}
