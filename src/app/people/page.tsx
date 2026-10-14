import { Nav } from "@/components/nav";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { listPeople, type PersonRow } from "@/lib/people";
import { requireAction } from "@/lib/session";
import Link from "next/link";
import { addWorkEmailAction, removePersonAction, removeWorkEmailAction } from "./actions";

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
  "person-removed": { tone: "ok", text: "Removed. They lost every role in every app. Their record and history stay." },
  "remove-not-found": { tone: "error", text: "That person was not found, or was already removed." },
  "remove-yourself": { tone: "error", text: "You cannot remove yourself. Ask another admin." },
};

function Notice({ search }: { search: Search }) {
  const key = typeof search.notice === "string" ? search.notice : "";
  const n = NOTICES[key];
  return n ? <p className={`notice ${n.tone}`} role={n.tone === "error" ? "alert" : "status"}>{n.text}</p> : null;
}

function Status({ p }: { p: PersonRow }) {
  if (!p.is_active) return <span className="pill muted">Inactive</span>;
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
            <p className="muted">{active} active, {people.length - active} inactive. Imported once from HR, plus people added in Account Center. This is the real list.</p>
          </div>
        </div>

        <Notice search={search} />

        {canManage && typeof search.remove === "string" ? (() => {
          const target = people.find((p) => p.id === search.remove && p.is_active);
          return target ? (
            <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
              <p id="confirm-title"><strong>Remove {target.display_name}?</strong> Use this when someone leaves. They lose every role in every app at once. Their record and history stay.</p>
              <div className="row">
                <form action={removePersonAction}>
                  <input type="hidden" name="person_id" value={target.id} />
                  <button type="submit" className="danger">Remove {target.display_name}</button>
                </form>
                <Link href="/people" className="button secondary">Cancel</Link>
              </div>
            </div>
          ) : null;
        })() : null}

        {people.length === 0 ? (
          <p className="empty">Nobody here yet. The people from HR are imported once, when Account Center is set up in Project Friday.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Name</th><th>HR email</th><th>Work emails</th><th>From</th><th>Status</th><th>Roles</th>{canManage ? <th><span className="sr-only">Remove</span></th> : null}</tr>
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
                    <td>{p.source === "hr" ? "HR import" : "Account Center"}</td>
                    <td><Status p={p} /></td>
                    <td className="num">{p.role_count}</td>
                    {canManage ? (
                      <td>{p.is_active && p.id !== me.person_id ? <Link href={`/people?remove=${p.id}`} className="danger-link">Remove</Link> : null}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small-text">Work emails let people who still sign in with Google be matched to their account. HR details (phone, birthday, salary) were never imported. When someone leaves, remove them here: they lose every role in every app at once.</p>
      </main>
    </>
  );
}
