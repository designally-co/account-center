import Link from "next/link";
import { ACTIONS, canUser } from "@/lib/access";
import { accessSummary, getPersonAccess, listKinds, visibilityOf } from "@/lib/access-lists";
import { VisibilityToggle } from "./visibility-toggle";
import { AppIcon } from "@/components/app-icon";
import { db } from "@/lib/db";
import { SaveNotice } from "./access-form";
import { APP_NOTICES, SHARED_NOTICES, pick } from "./app-access";
import { KindForm } from "./kind-form";
import { TeamForm } from "./team-form";
import { ExtraTeamsForm } from "./extra-teams-form";
import { activeTeams } from "@/lib/teams";
import { subscriptionsOf } from "@/lib/subscriptions";
import { WorkEmails } from "./work-emails";
import { removePersonAction, sendInviteAction, workEmailAction } from "../actions";
import { inviteMessage } from "../invite-messages";
import { InviteRow } from "./invite-row";
import { ConfirmAction } from "@/components/confirm-action";
import { setAppVisibleAction, setExtraTeamsAction, setKindAction, setTeamAction } from "./actions";

// What a person's popup holds on the People page (Buk, 2026-11-03: "I want the person view to be like the team
// popup too"); it was the person's own page until then. The popup draws the face, the name and the status line
// itself, from the People list, so they show at once; this part comes from the server a moment later.
// The caller has already checked that the viewer may view Account Center.
export async function PersonView({ id, userId, meId, notice }: { id: string; userId: string; meId: string; notice: string }) {
  const sql = db();
  const [person, kinds, canManage, teams, subs] = await Promise.all([getPersonAccess(sql, id), listKinds(sql), canUser(sql, userId, ACTIONS.manage), activeTeams(sql), subscriptionsOf(sql, id)]);
  if (!person) return <p className="notice error" role="alert">That person was not found. Reload the page and try again.</p>;

  const kind = kinds.find((k) => k.key === person.kind);
  const kindLabel = kind?.name ?? person.kind;
  const noticeKey = notice;
  const topNotice = pick(SHARED_NOTICES, noticeKey) ?? pick(APP_NOTICES, noticeKey) ?? (noticeKey.startsWith("invite-") ? inviteMessage(noticeKey.slice(7)) : null);
  const isMe = person.id === meId;

  return (
    // Each part is its own card under the person's card (Buk, 2026-11-03: separate containers, no outlines);
    // the cards rise in after the person's card has grown (data-grow-follow).
    <div className="person-detail">
      {topNotice || !canManage ? (
        <div className="person-notices" data-grow-follow>
          {topNotice ? <SaveNotice tone={topNotice.tone} text={topNotice.text} /> : null}
          {!canManage ? <p className="notice">View only</p> : null}
        </div>
      ) : null}

      <section className="stack-card person-section details" aria-label="Details" data-grow-follow>
        <KindForm save={setKindAction} personId={person.id} personName={person.display_name}
          kinds={kinds.map(({ key, name }) => ({ key, name }))} appNames={Object.fromEntries(person.apps.map((a) => [a.key, a.name]))}
          current={person.kind} locked={!canManage || !person.is_active || isMe} />
        <TeamForm save={setTeamAction} personId={person.id} teams={teams} current={person.team} hasExtras={person.extra_teams.length > 0}
          locked={!canManage || !person.is_active} />
        <ExtraTeamsForm key={person.team?.id ?? ""} save={setExtraTeamsAction}
          personId={person.id} teams={teams} primary={person.team?.id ?? null} current={person.extra_teams}
          locked={!canManage || !person.is_active} />
        {canManage && person.is_active && (person.login === "missing" || person.login === "invited") ? (
          <InviteRow action={sendInviteAction} personId={person.id} invited={person.login === "invited"} offerLink={noticeKey === "invite-account-exists"} />
        ) : null}
        <WorkEmails action={workEmailAction} personId={person.id} emails={person.work_emails} canManage={canManage}
          canAdd={canManage && person.is_active} />
      </section>

      <section className="stack-card person-section" aria-labelledby="apps-title" data-grow-follow>
        <h3 id="apps-title" className="person-section-title">Apps <span>{person.apps.length}</span></h3>
        {/* One card per app, two to a row (Buk, 2026-10-26); each opens the app's own access page. */}
        <ul className="access-grid">
          {person.apps.map((app, i) => {
            const summary = accessSummary(app, kindLabel);
            const line = app.actions.length === 0 && !app.keptOut ? "No actions yet" : summary.text;
            const vis = visibilityOf(app, person, { canManage, isMe });
            // Like Claude's connector cards (Buk's reference, 2026-10-26): icon tile, name, what the app does,
            // the access in one muted line. The card opens the app's page; the button at the top right makes
            // the app visible or hidden for this person, after a confirmation.
            return (
              <li key={app.key} style={{ "--i": i } as React.CSSProperties}>
                <div className="access-card">
                  <span className="access-card-icon"><AppIcon appKey={app.key} name={app.name} icon={app.icon} hue={app.hue} size={32} /></span>
                  <span className="access-card-text">
                    <strong>
                      <Link href={`/people/${person.id}/apps/${app.key}`} className="access-card-link">{app.name}</Link>
                      {app.isPrototype ? <span className="pill plain">Prototype</span> : null}
                    </strong>
                    {app.description ? <span className="access-card-desc">{app.description}</span> : null}
                    <span className={`access-card-summary ${summary.tone}`}>{line}</span>
                  </span>
                  <VisibilityToggle action={setAppVisibleAction} personId={person.id} personName={person.display_name} appKey={app.key}
                    appName={app.name} version={app.version} on={vis.on} roleName={vis.roleName} locked={vis.locked} from="person" variant="icon" />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      {subs.length ? (
        <section className="stack-card person-section" aria-labelledby="subs-title" data-grow-follow>
          <h3 id="subs-title" className="person-section-title">Shared subscriptions <span>{subs.length}</span></h3>
          {!person.is_active ? (
            <p className="notice warn" role="status">{person.display_name} left and knew these shared logins. Change each password, then take them off on the subscription&apos;s page.</p>
          ) : null}
          <ul className="person-subs">
            {subs.map((s) => (
              <li key={s.id}>
                <Link href={`/subscriptions/${s.id}`}><span>{s.name}</span></Link>
                <span className="muted small-text">{s.shared_email}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage && person.is_active && !isMe ? (
        <section className="stack-card person-section remove-zone" aria-labelledby="remove-title" data-grow-follow>
          <div className="remove-words">
            <h3 id="remove-title" className="person-section-title">Remove from Account Center</h3>
            <p className="muted small-text">For someone who left. They lose all access in every app; their record and history stay.</p>
          </div>
          <div>
            <ConfirmAction action={removePersonAction} fields={{ person_id: person.id }} trigger={`Remove ${person.display_name}`}
              title={`Remove ${person.display_name}?`} confirm={`Remove ${person.display_name}`} pending="Removing…"
              body={`They lose all access in every app at once. Their record and history stay.${subs.length ? ` They knew ${subs.length} shared ${subs.length === 1 ? "login" : "logins"}: change ${subs.length === 1 ? "that password" : "those passwords"} next.` : ""}`} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
