import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/access";
import { Avatar } from "./avatar";
import { BRAND_HUE, Orb } from "./orb";

// People and Teams are shown only to those who may see them; the pages check again on the server.
export function Nav({ current, me, canView }: { current: "home" | "people" | "teams" | "avatar"; me: Me; canView: boolean }) {
  return (
    <header className="nav">
      <nav aria-label="Account Center">
        <span className="brand"><Orb seed="account_center" hue={BRAND_HUE} size={22} /><span className="brand-text">Account Center</span></span>
        <Link href="/" aria-current={current === "home" ? "page" : undefined}>Home</Link>
        {canView ? <Link href="/people" aria-current={current === "people" ? "page" : undefined}>People</Link> : null}
        {canView ? <Link href="/teams" aria-current={current === "teams" ? "page" : undefined}>Teams</Link> : null}
      </nav>
      <form action={signOut} className="who">
        <Link href="/avatar" className="who-avatar" aria-label="Your avatar" aria-current={current === "avatar" ? "page" : undefined}>
          <Avatar avatar={me.avatar} seed={me.person_id} size={32} />
        </Link>
        <span className="muted">{me.display_name}</span>
        <button type="submit" className="secondary small">Sign out</button>
      </form>
    </header>
  );
}
