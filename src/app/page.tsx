import { ACTIONS } from "@/lib/access";
import { requireAction } from "@/lib/session";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

const APP_NAMES: Record<string, string> = {
  account_center: "Account Center",
  ma: "MA Desk",
  studio: "Article Studio",
  hub: "Knowledge Hub",
  survey: "Survey",
  brand: "Brand guideline portal",
  hr: "HR",
};

export default async function HomePage() {
  const { me } = await requireAction(ACTIONS.view);
  return (
    <main className="wide">
      <header className="top">
        <div>
          <p className="eyebrow">Account Center</p>
          <h1>Hello, {me.display_name}</h1>
        </div>
        <form action={signOut}><button type="submit" className="secondary">Sign out</button></form>
      </header>

      <section className="stack">
        <h2>Your roles</h2>
        <ul className="roles">
          {me.roles.map((r) => (
            <li key={`${r.app}.${r.role}`}><strong>{APP_NAMES[r.app] ?? r.app}</strong> <span className="muted">{r.role}</span></li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h2>Coming next</h2>
        <ul className="muted">
          <li>People: everyone copied from HR, and their work emails</li>
          <li>Access: apps, roles, and who has them</li>
          <li>Create account: a one-time link to set a password</li>
          <li>Change log</li>
        </ul>
      </section>
    </main>
  );
}
