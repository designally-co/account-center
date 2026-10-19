import { ACTIONS } from "@/lib/access";
import { accessSummary, getPersonAccess } from "@/lib/access-lists";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { Nav } from "@/components/nav";
import { Orb, initials } from "@/components/orb";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { me } = await requireAction(ACTIONS.view);
  // What the real check gives: roles, plus or minus single changes, never an app the kind is kept out of.
  const access = await getPersonAccess(db(), me.person_id);
  const mine = (access?.apps ?? []).map((app) => ({ app, s: accessSummary(app, access?.kind ?? "") })).filter(({ s }) => s.on > 0);
  return (
    <>
      <Nav current="home" name={me.display_name} personId={me.person_id} />
      <main className="wide">
        <div className="person-head">
          <Orb seed={me.person_id} size={64} label={initials(me.display_name)} />
          <div className="stack tight">
            <h1>Hello, {me.display_name}</h1>
            <p className="muted">Your access in Designally&apos;s apps</p>
          </div>
        </div>

        <section className="stack">
          <ul className="access-cards">
            {mine.map(({ app, s }) => (
              <li key={app.key} className="access-card">
                <Orb seed={app.key} size={32} />
                <strong>{app.name}</strong>
                <span className="what">{s.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="stack">
          <h2>Coming next</h2>
          <ul className="muted">
            <li>Create account: a one-time link to set a password</li>
            <li>Change log</li>
          </ul>
        </section>
      </main>
    </>
  );
}
