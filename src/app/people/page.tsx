import { Nav } from "@/components/nav";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { listPeople, type PersonRow } from "@/lib/people";
import { requireAction } from "@/lib/session";
import { addWorkEmailAction, copyFromHrAction, removeWorkEmailAction } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Messages come from this fixed list only; nothing from the address bar is shown as typed.
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "email-added": { tone: "ok", text: "Work email added." },
  "email-removed": { tone: "ok", text: "Work email removed." },
  "email-not-found": { tone: "error", text: "That work email was already gone." },
  invalid: { tone: "error", text: "That does not look like an email address. Check it and try again." },
  taken: { tone: "error", text: "That email is already the work email of someone else." },
  "main-email-of-another": { tone: "error", text: "That email is someone else's HR email, so it cannot be a work email here." },
  "no-person": { tone: "error", text: "That person was not found. Reload the page and try again." },
};

function num(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function Notice({ search }: { search: Search }) {
  const key = typeof search.notice === "string" ? search.notice : "";
  if (key === "copied") {
    const text = `Copied from HR: ${num(search.added)} added, ${num(search.updated)} updated, ${num(search.linked)} linked, ${num(search.inactive)} marked as left.`;
    return <p className="notice ok" role="status">{text}</p>;
  }
  const n = NOTICES[key];
  return n ? <p className={`notice ${n.tone}`} role={n.tone === "error" ? "alert" : "status"}>{n.text}</p> : null;
}

function Status({ p }: { p: PersonRow }) {
  if (!p.is_active) return <span className="pill muted">Left HR</span>;
  if (p.login === "blocked") return <span className="pill warn">Login blocked</span>;
  if (p.login === "missing") return <span className="pill warn">No login</span>;
  return <span className="pill ok">Active</span>;
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [people, canManage, search] = await Promise.all([listPeople(sql), canUser(sql, userId, ACTIONS.manage), searchParams]);
  const active = people.filter((p) => p.is_active).length;

  return (
    <>
      <Nav current="people" name={me.display_name} />
      <main className="wide">
        <div className="top">
          <div>
            <h1>People</h1>
            <p className="muted">{active} active, {people.length - active} left HR. Copied from HR, plus people made in Account Center.</p>
          </div>
          {canManage ? (
            <form action={copyFromHrAction}><button type="submit">Copy from HR now</button></form>
          ) : null}
        </div>

        <Notice search={search} />

        {people.length === 0 ? (
          <p className="empty">Nobody here yet. {canManage ? "Press \"Copy from HR now\" to bring in the people from HR." : "An admin needs to copy the people from HR."}</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Name</th><th>HR email</th><th>Work emails</th><th>From</th><th>Status</th><th>Roles</th></tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className={p.is_active ? undefined : "faded"}>
                    <td className="name">{p.display_name}</td>
                    <td>{p.email}</td>
                    <td>
                      <div className="chips">
                        {p.work_emails.map((e) => (
                          <span key={e} className="chip">
                            {e}
                            {canManage ? (
                              <form action={removeWorkEmailAction}>
                                <input type="hidden" name="person_id" value={p.id} />
                                <input type="hidden" name="email" value={e} />
                                <button type="submit" className="link" aria-label={`Remove ${e}`}>Remove</button>
                              </form>
                            ) : null}
                          </span>
                        ))}
                        {canManage && p.is_active ? (
                          <form action={addWorkEmailAction} className="inline">
                            <input type="hidden" name="person_id" value={p.id} />
                            <label className="sr-only" htmlFor={`email-${p.id}`}>Work email for {p.display_name}</label>
                            <input id={`email-${p.id}`} name="email" type="email" placeholder="name@designally.co" required />
                            <button type="submit" className="secondary small">Add</button>
                          </form>
                        ) : null}
                        {!canManage && p.work_emails.length === 0 ? <span className="muted">None</span> : null}
                      </div>
                    </td>
                    <td>{p.source === "hr" ? "HR" : "Account Center"}</td>
                    <td><Status p={p} /></td>
                    <td className="num">{p.role_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small-text">Work emails let people who still sign in with Google be matched to their account. HR details (phone, birthday, salary) are never copied here.</p>
      </main>
    </>
  );
}
