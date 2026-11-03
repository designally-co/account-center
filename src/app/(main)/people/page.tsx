import { Toast } from "@/components/toast";
import { ACTIONS, canUser } from "@/lib/access";
import { db } from "@/lib/db";
import { listPeople } from "@/lib/people";
import { PeopleBrowser } from "./people-browser";
import { requireAction } from "@/lib/session";
import Link from "next/link";
import { isUuid } from "@/lib/ids";
import { PersonView } from "./[id]/person-view";

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
  if (typeof search.person === "string") return null;   // a notice about the open person shows inside their popup
  const key = typeof search.notice === "string" ? search.notice : "";
  const n = Object.hasOwn(NOTICES, key) ? NOTICES[key] : null;
  if (!n) return null;
  return n.tone === "ok" ? <Toast text={n.text} /> : <p className="notice error" role="alert">{n.text}</p>;
}

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [people, canManage, search] = await Promise.all([listPeople(sql), canUser(sql, userId, ACTIONS.manage), searchParams]);
  // Cards by default; the list (a table) is one click away (Buk, 2026-10-19).
  const view = search.view === "list" ? "list" : "grid";
  // A person opens as a popup over the list (Buk, 2026-11-03), at /people?person=<id>. Only that one person's
  // details are read; the popup shows their face and name from the list at once, and these when they arrive.
  const asked = typeof search.person === "string" && isUuid(search.person) && people.some((p) => p.id === search.person) ? search.person : null;
  const detail = asked ? {
    id: asked,
    node: <PersonView id={asked} userId={userId} meId={me.person_id} notice={typeof search.notice === "string" ? search.notice : ""} />,
  } : null;

  return (
    <>
      <main className="wide">
        <div className="top">
          <div>
            <h1>People</h1>
            <p className="muted">Everyone at Designally and their access</p>
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
        ) : <PeopleBrowser people={people} view={view} detail={detail} />}
      </main>
    </>
  );
}
