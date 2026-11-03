"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import type { TeamDetail as Team } from "@/lib/teams";
import { setTeamActiveAction, setTeamRoleAction, updateTeamAction } from "./actions";
import { DefaultRole } from "./default-role";
import { TeamMembers, type PickPerson } from "./team-members";

// What a team's popup holds (it was the team's own page until 2026-11-03). Members first, because adding and
// taking off people is what an admin opens a team for (Buk, 2026-11-03: "user must go inside first to add the
// team member"); then default access, the name, and Turn off at the bottom.
export function TeamDetail({ team, people, canManage, error, titleId }: {
  team: Team; people: PickPerson[]; canManage: boolean; error: string | null; titleId: string;
}) {
  const leads = team.members.filter((m) => m.is_lead);
  return (
    <div className="stack team-detail">
      <div className="team-detail-head">
        <h2 id={titleId} className="team-detail-title">{team.name}</h2>
        <p className="muted">
          {team.members.length} {team.members.length === 1 ? "member" : "members"}
          {leads.length ? ` · led by ${leads.map((l) => l.display_name).join(", ")}` : " · no lead"}
          {team.is_active ? "" : " · turned off"}
        </p>
        {team.description ? <p className="small-text">{team.description}</p> : null}
      </div>

      {error ? <p className="notice error" role="alert">{error}</p> : null}
      {!canManage ? <p className="notice">View only</p> : null}
      {canManage && !team.is_active ? (
        <form action={setTeamActiveAction} className="row">
          <input type="hidden" name="team_id" value={team.id} />
          <input type="hidden" name="active" value="1" />
          <p className="muted">This team is turned off and gives nothing.</p>
          <SubmitButton className="secondary" pendingText="Turning on…">Turn on</SubmitButton>
        </form>
      ) : null}

      <section className="stack" aria-labelledby={`${titleId}-members`}>
        <div className="members-head">
          <h3 id={`${titleId}-members`}>Members</h3>
          {canManage && team.is_active ? (
            <TeamMembers teamId={team.id} teamName={team.name} people={people} members={team.members.map((m) => m.id)} />
          ) : null}
        </div>
        <p className="muted small-text">
          {canManage && team.is_active
            ? "Press the faces to add someone or take them off. Adding someone from another team moves them here. A lead is set on the person's own page."
            : "To add someone, or move them here from another team, open their page and choose this team."}
        </p>
        {team.members.length === 0 ? <p className="empty">No active members.</p> : (
          <ul className="team-members">
            {team.members.map((m) => (
              <li key={m.id}>
                <Link href={`/people/${m.id}`}>
                  <Avatar avatar={m.avatar} seed={m.id} size={36} />
                  <span>{m.display_name}</span>
                </Link>
                {m.is_lead ? <span className="pill plain">Lead</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack" aria-labelledby={`${titleId}-defaults`}>
        <div>
          <h3 id={`${titleId}-defaults`}>Default access</h3>
          <p className="muted small-text">Every member gets this role in the app, unless an admin set their own access there. Account Center itself is never given by a team.</p>
        </div>
        <div className="team-defaults">
          {team.defaults.map((d) => (
            <DefaultRole key={`${d.app_key}:${d.role_key ?? ""}`} action={setTeamRoleAction} teamId={team.id} appKey={d.app_key} appName={d.app_name}
              roles={d.roles.map(({ key, name }) => ({ key, name }))} current={d.role_key ?? ""} locked={!canManage} />
          ))}
        </div>
      </section>

      {canManage ? (
        <section className="panel stack" aria-labelledby={`${titleId}-details`}>
          <h3 id={`${titleId}-details`}>Name and description</h3>
          <form action={updateTeamAction} className="stack">
            <input type="hidden" name="team_id" value={team.id} />
            <label className="field">Name <input name="name" required maxLength={60} defaultValue={team.name} /></label>
            <label className="field">Short description (optional) <input name="description" maxLength={160} defaultValue={team.description} /></label>
            <div><SubmitButton className="secondary" pendingText="Saving…">Save</SubmitButton></div>
          </form>
        </section>
      ) : null}

      {canManage && team.is_active ? (
        <section className="stack remove-zone" aria-labelledby={`${titleId}-off`}>
          <h3 id={`${titleId}-off`}>Turn off</h3>
          <div className="row">
            <p className="muted">For a team that no longer exists. Its members keep only the access set for them personally.</p>
            <ConfirmAction action={setTeamActiveAction} fields={{ team_id: team.id, active: "0" }} trigger={`Turn off ${team.name}`}
              title={`Turn off ${team.name}?`} confirm="Turn off" pending="Turning off…"
              body={`${team.members.length ? `Its ${team.members.length} ${team.members.length === 1 ? "member loses" : "members lose"} the team's default access at once.` : "Nobody is in it."} Access set for each person stays, and you can turn it on again.`} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
