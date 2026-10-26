import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/nav";
import { Avatar } from "@/components/avatar";
import { ACTIONS, canUser } from "@/lib/access";
import { accessSummary, getPersonAccess, listKinds, type PersonAccess } from "@/lib/access-lists";
import { AppIcon } from "@/components/app-icon";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/session";
import { SaveNotice } from "./access-form";
import { SHARED_NOTICES, pick } from "./app-access";
import { KindForm } from "./kind-form";
import { TeamForm } from "./team-form";
import { activeTeams } from "@/lib/teams";
import { subscriptionsOf } from "@/lib/subscriptions";
import { WorkEmails } from "./work-emails";
import { removePersonAction, sendInviteAction, workEmailAction } from "../actions";
import { inviteMessage } from "../invite-messages";
import { InviteRow } from "./invite-row";
import { setKindAction, setTeamAction } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
function Status({ p }: { p: PersonAccess }) {
  if (!p.is_active) return <span className="pill muted">Removed</span>;
  if (p.login === "blocked") return <span className="pill warn">Login blocked</span>;
  if (p.login === "missing") return <span className="pill warn">No login</span>;
  if (p.login === "invited") return <span className="pill">Invited</span>;
  return <span className="pill ok">Active</span>;
}

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { userId, me } = await requireAction(ACTIONS.view);
  const sql = db();
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const [person, kinds, canManage, teams, subs] = await Promise.all([getPersonAccess(sql, id), listKinds(sql), canUser(sql, userId, ACTIONS.manage), activeTeams(sql), subscriptionsOf(sql, id)]);
  if (!person) notFound();

  const kind = kinds.find((k) => k.key === person.kind);
  const kindLabel = kind?.name ?? person.kind;
  const noticeKey = typeof search.notice === "string" ? search.notice : "";
  const topNotice = pick(SHARED_NOTICES, noticeKey) ?? (noticeKey.startsWith("invite-") ? inviteMessage(noticeKey.slice(7)) : null);
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
          <TeamForm save={setTeamAction} personId={person.id} teams={teams} current={person.team}
            locked={!canManage || !person.is_active} />
          {canManage && person.is_active && (person.login === "missing" || person.login === "invited") ? (
            <InviteRow action={sendInviteAction} personId={person.id} invited={person.login === "invited"} offerLink={noticeKey === "invite-account-exists"} />
          ) : null}
          <WorkEmails action={workEmailAction} personId={person.id} emails={person.work_emails} canManage={canManage}
            canAdd={canManage && person.is_active} />
        </section>

        {subs.length ? (
          <section className="stack" aria-labelledby="subs-title">
            <h2 id="subs-title">Shared subscriptions</h2>
            {!person.is_active ? (
              <p className="notice warn" role="status">{person.display_name} left and knew these shared logins. Change each password, then take them off on the subscription&apos;s page.</p>
            ) : null}
            <ul className="team-members">
              {subs.map((s) => (
                <li key={s.id}>
                  <Link href={`/subscriptions/${s.id}`}><span>{s.name}</span></Link>
                  <span className="muted small-text">{s.shared_email}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="stack" aria-labelledby="apps-title">
          <h2 id="apps-title">Apps</h2>
          {/* One card per app, two to a row (Buk, 2026-10-26); each opens the app's own access page. */}
          <ul className="access-grid">
            {person.apps.map((app) => {
              const summary = accessSummary(app, kindLabel);
              const has = summary.on > 0;
              const line = app.actions.length === 0 && !app.keptOut ? "No actions yet" : summary.text;
              // Like Claude's connector cards (Buk's reference, 2026-10-26): icon tile, name, what the app does,
              // the access in one muted line, and a tick or a plus at the top right.
              return (
                <li key={app.key}>
                  <Link href={`/people/${person.id}/apps/${app.key}`} className="access-card"
                    aria-label={`${app.name}: ${line}. Open to change ${person.display_name}'s access`}>
                    <span className="access-card-icon"><AppIcon appKey={app.key} icon={app.icon} hue={app.hue} size={32} /></span>
                    <span className="access-card-text">
                      <strong>{app.name}{app.isPrototype ? <span className="pill plain">Prototype</span> : null}</strong>
                      {app.description ? <span className="access-card-desc">{app.description}</span> : null}
                      <span className={`access-card-summary ${summary.tone}`}>{line}</span>
                    </span>
                    <span className={`access-card-state${has ? " on" : ""}`} aria-hidden="true">
                      {has
                        ? <svg width="18" height="18" viewBox="0 0 18 18"><path d="M3.5 9.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 3.5v11M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        {canManage && person.is_active && !isMe ? (
          <section className="stack remove-zone" aria-labelledby="remove-title">
            <h2 id="remove-title">Remove from Account Center</h2>
            {search.confirm === "remove" ? (
              <div className="confirm" role="alertdialog" aria-labelledby="confirm-title">
                <p id="confirm-title"><strong>Remove {person.display_name}?</strong> They lose all access in every app at once. Their record and history stay.</p>
                <div className="row">
                  <form action={removePersonAction}>
                    <input type="hidden" name="person_id" value={person.id} />
                    <button type="submit" className="danger">Remove {person.display_name}</button>
                  </form>
                  <Link href={`/people/${person.id}`} className="button secondary">Cancel</Link>
                </div>
              </div>
            ) : (
              <div className="row">
                <p className="muted">For someone who left. They lose all access in every app; their record and history stay.</p>
                <Link href={`/people/${person.id}?confirm=remove#remove-title`} className="button secondary danger-outline">Remove {person.display_name}</Link>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </>
  );
}
