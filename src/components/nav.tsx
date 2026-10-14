import Link from "next/link";
import { signOut } from "@/app/actions";

export function Nav({ current, name }: { current: "home" | "people"; name: string }) {
  return (
    <header className="nav">
      <nav aria-label="Account Center">
        <span className="brand">Account Center</span>
        <Link href="/" aria-current={current === "home" ? "page" : undefined}>Home</Link>
        <Link href="/people" aria-current={current === "people" ? "page" : undefined}>People</Link>
      </nav>
      <form action={signOut} className="who">
        <span className="muted">{name}</span>
        <button type="submit" className="secondary small">Sign out</button>
      </form>
    </header>
  );
}
