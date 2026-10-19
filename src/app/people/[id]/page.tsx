import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Orb, initials } from "@/components/orb";
import { ACTIONS, canUser } from "@/lib/access";
import { accessSummary, getPersonAccess, listKinds, type AppAccess, type PersonAccess } from "@/lib/access-lists";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { AppPanel, SaveNotice } from "./access-form";
import { addWorkEmailAction, removeWorkEmailAction } from "../actions";
import { saveAppAccessAction, setKindAction } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
type Notice = { tone: "ok" | "error"; text: string };

// Messages come from these fixed lists only; nothing from the address bar is shown as typed.
// Kind and work email messages show at the top. App messages show inside the app that was saved.
function topNoticeFor(key: string, person: PersonAccess, blockedApp: AppAccess | undefined): Notice | null {
  switch (key) {
    case "kind-saved": return { tone: "ok", text: "Kind saved." };
    case "kind-blocked": {
      const app = blockedApp?.name ?? "an app";
      return { tone: "error", text: `Not saved: that kind can never use ${app}, and ${person.display_name} still has access there. In ${app} below, choose "No access" and save. Then change the kind.` };
    }
    case "unknown-kind": return { tone: "error", text: "That kind does not exist. Reload the page and try again." };
    case "email-added": return { tone: "ok", text: "Work email added." };
    case "email-removed": return { tone: "ok", text: "Work email removed." };
    case "email-not-found": return { tone: "error", text: "That work email was already gone." };
    case "invalid": return { tone: "error", text: "That does not look like an email address." };
    case "taken": return { tone: "error", text: "That email is already someone else's work email." };
    case "main-email-of-another": return { tone: "error", text: "That email is someone else's HR email." };
    case "no-person": return { tone: "error", text: "That person was not found. Reload the page and try again." };
    default: return null;
  }
}

const APP_NOTICES: Record<string, Notice> = {
  saved: { tone: "ok", text: "Saved." },
  "role-only": { tone: "ok", text: "Role saved. Check the actions below and save again if needed." },
  "kept-out": { tone: "error", text: "Not saved: this person's kind can never use this app." },
  changed: { tone: "error", text: "Not saved: someone changed this access after you opened the page. Check it again below, then save." },
  yourself: { tone: "error", text: "You cannot change your own Account Center access. Ask another admin." },
  "unknown-role": { tone: "error", text: "That role does not exist for this app. Reload the page and try again." },
  "unknown-app": { tone: "error", text: "That app was not found. Reload the page and try again." },
};

// Messages that can come from either kind of form.
const SHARED_NOTICES: Record<string, Notice> = {
  inactive: { tone: "error", text: "This person was removed. Their access cannot be changed." },
  "not-found": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

function Status({ p }: { p: PersonAccess }) {
  if (!p.is_active) return <span className="pill muted">Removed</span>;
  if (p.login === "blocked") return <span className="pill warn">Login blocked</span>;
  if (p.login === "missing") return <span className="pill warn">No login</span>;
  return <span className="pill ok">Active</span>;
}

function AppSection({ person, app, kindLabel, canManage, isMe, open, notice }: {
  person: PersonAccess; app: AppAccess; kindLabel: string; canManage: boolean; isMe: boolean; open: boolean; notice: Notice | null;
}) {
  const own = isMe && app.key === "account_center";
  return (
    <AppPanel
      save={saveAppAccessAction}
      personId={person.id}
      appKey={app.key}
      appName={app.name}
      isPrototype={app.isPrototype}
      version={app.version}
      roles={app.roles.map(({ key, name, actions }) => ({ key, name, actions }))}
      actions={app.actions.map(({ key, description, on }) => ({ key, description, on: on && !app.keptOut }))}
      currentRole={app.roleKeys[0] ?? ""}
      locked={!canManage || !person.is_active || own}
      lockedNote={own && canManage ? "Ask another admin to change your own access." : null}
      keptOut={app.keptOut ? `Never for ${kindLabel}` : null}
      leftover={app.keptOut && (app.roleKeys.length > 0 || app.actions.some((a) => a.exception !== null))}
      initiallyOpen={open}
      notice={notice}
    />
  );
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [person, kinds, canManage] = await Promise.all([getPersonAccess(sql, id), listKinds(sql), canUser(sql, userId, ACTIONS.manage)]);
  if (!person) notFound();

  const kind = kinds.find((k) => k.key === person.kind);
  const kindLabel = kind?.name ?? person.kind;
  const openApp = typeof search.app === "string" ? search.app : "";
  const noticeKey = typeof search.notice === "string" ? search.notice : "";
  const appForNotice = person.apps.find((a) => a.key === openApp);
  const topNotice = topNoticeFor(noticeKey, person, appForNotice) ?? (!appForNotice ? SHARED_NOTICES[noticeKey] ?? null : null);
  const appNotice = appForNotice && !topNotice ? APP_NOTICES[noticeKey] ?? SHARED_NOTICES[noticeKey] ?? null : null;
  const isMe = person.id === me.person_id;
  const withAccess = person.apps.filter((a) => accessSummary(a, "").on > 0).length;

  return (
    <>
      <Nav current="people" name={me.display_name} personId={me.person_id} />
      <main className="wide">
        <p><Link href="/people" className="back">← People</Link></p>
        <div className="person-head">
          <Orb seed={person.id} size={64} label={initials(person.display_name)} />
          <div className="stack tight">
            <h1>{person.display_name}</h1>
            <p className="meta">
              <span>{person.email}</span>
              <Status p={person} />
              <span>{withAccess} {withAccess === 1 ? "app" : "apps"}</span>
            </p>
          </div>
        </div>

        {topNotice ? <SaveNotice tone={topNotice.tone} text={topNotice.text} /> : null}
        {!canManage ? <p className="notice">View only</p> : null}

        <form action={setKindAction} className="panel row-panel">
          <input type="hidden" name="person_id" value={person.id} />
          <label htmlFor="kind"><strong>Kind</strong></label>
          <span className="row">
            <select id="kind" name="kind" defaultValue={person.kind} disabled={!canManage || !person.is_active}>
              {kinds.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
            </select>
            {canManage && person.is_active ? <button type="submit" className="secondary small">Save</button> : null}
          </span>
        </form>

        <div className="panel row-panel">
          <strong>Work emails</strong>
          <div className="chips">
            {person.work_emails.map((e) => (
              <span key={e} className="chip">
                {e}
                {canManage ? (
                  <form action={removeWorkEmailAction}>
                    <input type="hidden" name="person_id" value={person.id} />
                    <input type="hidden" name="email" value={e} />
                    <button type="submit" className="chip-x" aria-label={`Remove ${e}`}>×</button>
                  </form>
                ) : null}
              </span>
            ))}
            {canManage && person.is_active ? (
              <form action={addWorkEmailAction} className="inline">
                <input type="hidden" name="person_id" value={person.id} />
                <label className="sr-only" htmlFor="work-email">Add a work email</label>
                <input id="work-email" name="email" type="email" placeholder="name@designally.co" required />
                <button type="submit" className="secondary small">Add</button>
              </form>
            ) : person.work_emails.length === 0 ? <span className="muted">None</span> : null}
          </div>
        </div>

        <section className="stack">
          <h2>Apps</h2>
          <div className="apps">
            {person.apps.map((app) => (
              <AppSection key={`${app.key}:${app.version}`} person={person} app={app} kindLabel={kindLabel} canManage={canManage} isMe={isMe}
                open={openApp === app.key} notice={app.key === appForNotice?.key ? appNotice : null} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
