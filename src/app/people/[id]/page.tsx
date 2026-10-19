import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { ACTIONS, canUser } from "@/lib/access";
import { accessSummary, getPersonAccess, listKinds, type AppAccess, type PersonAccess } from "@/lib/access-lists";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { AppPanel, SaveNotice } from "./access-form";
import { KindForm } from "./kind-form";
import { WorkEmails } from "./work-emails";
import { sendInviteAction, workEmailAction } from "../actions";
import { inviteMessage } from "../invite-messages";
import { InviteRow } from "./invite-row";
import { saveAppAccessAction, setKindAction } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
type Notice = { tone: "ok" | "error"; text: string };

// Messages come from these fixed lists only; nothing from the address bar is shown as typed.
// App messages show inside the app that was saved; Kind and work emails show their own answers.

const APP_NOTICES: Record<string, Notice> = {
  saved: { tone: "ok", text: "Saved." },
  "role-only": { tone: "ok", text: "Role saved. Check the actions below and save again if needed." },
  "kept-out": { tone: "error", text: "Not saved: this person's kind can never use this app." },
  "manage-needs-view": { tone: "error", text: "Not saved: someone who can manage Account Center must also be able to see it." },
  changed: { tone: "error", text: "Not saved: someone changed this access after you opened the page. Check it again below, then save." },
  yourself: { tone: "error", text: "You cannot change your own Account Center access. Ask another admin." },
  "unknown-role": { tone: "error", text: "That role does not exist for this app. Reload the page and try again." },
  "unknown-app": { tone: "error", text: "That app was not found. Reload the page and try again." },
};

// Only the lists' own keys count ("constructor" or "toString" in the address must find nothing).
function pick<T>(list: Record<string, T>, key: string): T | null {
  return Object.hasOwn(list, key) ? list[key] : null;
}

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
  if (p.login === "invited") return <span className="pill">Invited</span>;
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
      hue={app.hue}
      icon={app.icon}
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
  const topNotice = !appForNotice ? pick(SHARED_NOTICES, noticeKey) ?? (noticeKey.startsWith("invite-") ? inviteMessage(noticeKey.slice(7)) : null) : null;
  const appNotice = appForNotice && !topNotice ? pick(APP_NOTICES, noticeKey) ?? pick(SHARED_NOTICES, noticeKey) : null;
  const isMe = person.id === me.person_id;
  const withAccess = person.apps.filter((a) => accessSummary(a, "").on > 0).length;

  return (
    <>
      <Nav current="people" me={me} canView />
      <main className="wide">
        <p><Link href="/people" className="back">← People</Link></p>
        <div className="person-head">
          <Avatar avatar={person.avatar} seed={person.id} size={72} />
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

        <section className="panel details" aria-label="Details">
          <KindForm save={setKindAction} personId={person.id} personName={person.display_name}
            kinds={kinds.map(({ key, name }) => ({ key, name }))} appNames={Object.fromEntries(person.apps.map((a) => [a.key, a.name]))}
            current={person.kind} locked={!canManage || !person.is_active || isMe} />
          {canManage && person.is_active && (person.login === "missing" || person.login === "invited") ? (
            <InviteRow action={sendInviteAction} personId={person.id} invited={person.login === "invited"} offerLink={noticeKey === "invite-account-exists"} />
          ) : null}
          <WorkEmails action={workEmailAction} personId={person.id} emails={person.work_emails} canManage={canManage}
            canAdd={canManage && person.is_active} />
        </section>

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
