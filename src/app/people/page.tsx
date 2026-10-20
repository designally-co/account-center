import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { listPeople, type PersonRow } from "@/lib/people";
import { requireAction } from "@/lib/session";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

// Messages come from this fixed list only; nothing from the address bar is shown as typed.
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "no-person": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "person-removed": { tone: "ok", text: "Removed. They lost all access in every app. Their record and history stay." },
  "remove-not-found": { tone: "error", text: "That person was not found, or was already removed." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

function Notice({ search }: { search: Search }) {
  const key = typeof search.notice === "string" ? search.notice : "";
  const n = Object.hasOwn(NOTICES, key) ? NOTICES[key] : null;
  if (!n) return null;
  return n.tone === "ok" ? <Toast text={n.text} /> : <p className="notice error" role="alert">{n.text}</p>;
}

function Status({ p }: { p: PersonRow }) {
  if (!p.is_active) return <span className="pill muted">Inactive</span>;
  if (p.login === "blocked") return <span className="pill warn">Login blocked</span>;
  if (p.login === "missing") return <span className="pill warn">No login</span>;
  if (p.login === "invited") return <span className="pill">Invited</span>;
  return <span className="pill ok">Active</span>;
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [people, canManage, search] = await Promise.all([listPeople(sql), canUser(sql, userId, ACTIONS.manage), searchParams]);
  const active = people.filter((p) => p.is_active).length;
  // Cards by default; the list (a table) is one click away (Buk, 2026-10-19).
  const view = search.view === "list" ? "list" : "grid";

  return (
    <>
      <Nav current="people" me={me} canView />
      <main className="wide">
        <div className="top">
          <div>
            <h1>People</h1>
            <p className="muted">{active} active · {people.length - active} inactive</p>
          </div>
          <div className="row">
            <nav className="view-switch" aria-label="View">
              <Link href="/people?view=grid" aria-current={view === "grid" ? "page" : undefined}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" /><rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" /></svg>
                Grid
              </Link>
              <Link href="/people?view=list" aria-current={view === "list" ? "page" : undefined}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="2" rx="1" /><rect x="2" y="7" width="12" height="2" rx="1" /><rect x="2" y="11" width="12" height="2" rx="1" /></svg>
                List
              </Link>
            </nav>
            {canManage ? <Link href="/people/new" className="button">Add person</Link> : null}
          </div>
        </div>

        <Notice search={search} />


        {people.length === 0 ? (
          <p className="empty">Nobody here yet. The people from HR are imported once, when Account Center is set up in Project Friday.</p>
        ) : view === "grid" ? (
          <ul className="people-cards" aria-label="People">
            {people.map((p) => (
              <li key={p.id} className={`person-card${p.is_active ? "" : " faded"}`}>
                <Avatar avatar={p.avatar} seed={p.id} size={56} />
                <div className="person-card-text">
                  <Link href={`/people/${p.id}`} className="person-card-name">{p.display_name}</Link>
                  <span className="person-card-email">{p.email}</span>
                </div>
                <div className="person-card-meta">
                  <Status p={p} />
                  <span>{p.team ? `${p.team}${p.is_lead ? " · lead" : ""}` : "No team"}</span>
                  <span>{p.app_count} {p.app_count === 1 ? "app" : "apps"}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Team</th><th>Work emails</th><th>Employment</th><th>Status</th><th>Apps</th></tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className={p.is_active ? undefined : "faded"}>
                    <td className="name"><Link href={`/people/${p.id}`}><Avatar avatar={p.avatar} seed={p.id} size={36} /><span>{p.display_name}</span></Link></td>
                    <td>{p.email}</td>
                    <td>{p.team ? <>{p.team}{p.is_lead ? <span className="pill plain">Lead</span> : null}</> : <span className="muted">No team</span>}</td>
                    <td>
                      {p.work_emails.length ? (
                        <div className="chips">{p.work_emails.map((e) => <span key={e} className="chip">{e}</span>)}</div>
                      ) : <span className="muted">None</span>}
                    </td>
                    <td>{p.kind}</td>
                    <td><Status p={p} /></td>
                    <td className="num"><Link href={`/people/${p.id}`} aria-label={`${p.app_count} ${p.app_count === 1 ? "app" : "apps"}: access list of ${p.display_name}`}>{p.app_count}</Link></td>
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
