import Link from "next/link";
import { signOut } from "@/app/actions";
import { Orb, initials } from "./orb";

export function Nav({ current, name, personId }: { current: "home" | "people"; name: string; personId: string }) {
  return (
    <header className="nav">
      <nav aria-label="Account Center">
        <span className="brand"><Orb seed="designally-account-center" size={22} /><span className="brand-text">Account Center</span></span>
        <Link href="/" aria-current={current === "home" ? "page" : undefined}>Home</Link>
        <Link href="/people" aria-current={current === "people" ? "page" : undefined}>People</Link>
      </nav>
      <form action={signOut} className="who">
        <Orb seed={personId} size={26} label={initials(name)} />
        <span className="muted">{name}</span>
        <button type="submit" className="secondary small">Sign out</button>
      </form>
    </header>
  );
}
