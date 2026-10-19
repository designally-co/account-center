import { Nav } from "@/components/nav";
import { Orb, initials } from "@/components/orb";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { listPeople, type PersonRow } from "@/lib/people";
import { requireAction } from "@/lib/session";
import Link from "next/link";
import { removePersonAction } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Messages come from this fixed list only; nothing from the address bar is shown as typed.
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "no-person": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "person-removed": { tone: "ok", text: "Removed. They lost all access in every app. Their record and history stay." },
  "remove-not-found": { tone: "error", text: "That person was not found, or was already removed." },
  "remove-yourself": { tone: "error", text: "You cannot remove yourself. Ask another admin." },
  "remove-not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
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
      <Nav current="people" name={me.display_name} personId={me.person_id} />
      <main className="wide">
        <div className="top">
          <div>
            <h1>People</h1>
            <p className="muted">{active} active · {people.length - active} inactive</p>
          </div>
        </div>

        <Notice search={search} />

        {canManage && typeof search.remove === "string" ? (() => {
          const target = people.find((p) => p.id === search.remove && p.is_active);
          return target ? (
            <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
              <p id="confirm-title"><strong>Remove {target.display_name}?</strong> They lose all access in every app at once. Their record and history stay.</p>
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
                <tr><th>Name</th><th>Email</th><th>Work emails</th><th>Kind</th><th>Status</th><th>Apps</th>{canManage ? <th><span className="sr-only">Remove</span></th> : null}</tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className={p.is_active ? undefined : "faded"}>
                    <td className="name"><Link href={`/people/${p.id}`}><Orb seed={p.id} size={30} label={initials(p.display_name)} /><span>{p.display_name}</span></Link></td>
                    <td>{p.email}</td>
                    <td>
                      {p.work_emails.length ? (
                        <div className="chips">{p.work_emails.map((e) => <span key={e} className="chip">{e}</span>)}</div>
                      ) : <span className="muted">None</span>}
                    </td>
                    <td>{p.kind}</td>
                    <td><Status p={p} /></td>
                    <td className="num"><Link href={`/people/${p.id}`} aria-label={`${p.app_count} ${p.app_count === 1 ? "app" : "apps"}: access list of ${p.display_name}`}>{p.app_count}</Link></td>
                    {canManage ? (
                      <td>{p.is_active && p.id !== me.person_id ? <Link href={`/people?remove=${p.id}`} className="danger-link">Remove</Link> : null}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
