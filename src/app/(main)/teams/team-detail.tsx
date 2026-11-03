"use client";

import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import type { TeamDetail as Team } from "@/lib/teams";
import { setTeamRoleAction, updateTeamAction } from "./actions";
import { DefaultRole } from "./default-role";
import { TeamMembers, type PickPerson } from "./team-members";

// What a team's popup holds (it was the team's own page until 2026-11-03). Members first, because adding and
// taking off people is what an admin opens a team for (Buk, 2026-11-03: "user must go inside first to add the
// team member"); then default access and the name. Those settings are for an admin only; every other person
// sees the team and its members (Buk, 2026-11-03). A team is never turned off (Buk, 2026-11-03).
export function TeamDetail({ team, people, canManage, canView, error, titleId }: {
  team: Team; people: PickPerson[]; canManage: boolean; canView: boolean; error: string | null; titleId: string;
}) {
  const leads = team.members.filter((m) => m.is_lead);
  return (
    <div className="stack team-detail">
      <div className="team-detail-head">
        <h2 id={titleId} className="team-detail-title">{team.name}</h2>
        <p className="muted">
          {team.members.length} {team.members.length === 1 ? "member" : "members"}
          {leads.length ? ` · led by ${leads.map((l) => l.display_name).join(", ")}` : " · no lead"}
        </p>
        {team.description ? <p className="small-text">{team.description}</p> : null}
      </div>

      {error ? <p className="notice error" role="alert">{error}</p> : null}

      <section className="stack" aria-labelledby={`${titleId}-members`}>
        <div className="members-head">
          <h3 id={`${titleId}-members`}>Members</h3>
          {canManage ? (
            <TeamMembers teamId={team.id} teamName={team.name} people={people} members={team.members.map((m) => m.id)} leads={leads.map((l) => l.id)} />
          ) : null}
        </div>
        {canManage ? (
          <p className="muted small-text">
            Press the faces to add someone or take them off. Someone already in another team keeps it and gets this one as an extra team. A primary team and a lead are set on the person&apos;s own page.
          </p>
        ) : null}
        {team.members.length === 0 ? <p className="empty">No active members.</p> : (
          <ul className="team-members">
            {team.members.map((m) => {
              const face = (
                <>
                  <Avatar avatar={m.avatar} seed={m.id} size={36} />
                  <span>{m.display_name}</span>
                </>
              );
              return (
                <li key={m.id}>
                  {canView ? <Link href={`/people/${m.id}`}>{face}</Link> : <span className="team-member">{face}</span>}
                  {m.is_lead ? <span className="pill plain">Lead</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {canManage ? (
        <section className="panel stack" aria-labelledby={`${titleId}-defaults`}>
          <div>
            <h3 id={`${titleId}-defaults`}>Default access</h3>
            <p className="muted small-text">Every member gets this role in the app, unless an admin set their own access there. Account Center itself is never given by a team.</p>
          </div>
          <div className="team-defaults">
            {team.defaults.map((d) => (
              <DefaultRole key={`${d.app_key}:${d.role_key ?? ""}`} action={setTeamRoleAction} teamId={team.id} appKey={d.app_key} appName={d.app_name}
                roles={d.roles.map(({ key, name }) => ({ key, name }))} current={d.role_key ?? ""} locked={false} />
            ))}
          </div>
        </section>
      ) : null}

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
    </div>
  );
}
