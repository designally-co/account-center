import type postgres from "postgres";
import { NotAllowed, withActor } from "./actor";
import { isUuid } from "./ids";

// Teams (Buk, 2026-10-19): one team per person, any member can be a lead, and each team gives a default role
// per app. Account Center access is never given by a team (the database refuses it). Every change runs
// through withActor, like every other change to people and access.

export type TeamMember = { id: string; display_name: string; email: string; avatar: unknown; is_lead: boolean; is_active: boolean };
export type TeamDefault = { app_key: string; app_name: string; role_key: string | null; roles: { key: string; name: string }[] };
export type TeamSummary = {
  id: string; name: string; description: string; is_active: boolean;
  members: TeamMember[];
  defaults: { app_name: string; role_name: string }[];
};
export type TeamDetail = Omit<TeamSummary, "defaults"> & { defaults: TeamDefault[] };

export async function listTeams(sql: postgres.Sql): Promise<TeamSummary[]> {
  return sql<TeamSummary[]>`
    select t.id::text, t.name, t.description, t.is_active,
           coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'email', p.email, 'avatar', p.avatar,
                                                         'is_lead', m.is_lead, 'is_active', p.is_active)
                                      order by m.is_lead desc, lower(p.display_name))
                     from account.team_members m join account.people p on p.id = m.person_id
                     where m.team_id = t.id and p.is_active), '[]'::jsonb) as members,
           coalesce((select jsonb_agg(jsonb_build_object('app_name', a.name, 'role_name', r.name) order by a.name)
                     from account.team_roles tr
                     join account.apps a on a.key = tr.app_key
                     join account.roles r on r.app_key = tr.app_key and r.key = tr.role_key
                     where tr.team_id = t.id), '[]'::jsonb) as defaults
    from account.teams t
    order by t.is_active desc, lower(t.name)`;
}

export async function getTeam(sql: postgres.Sql, teamId: string): Promise<TeamDetail | null> {
  if (!isUuid(teamId)) return null;
  const [team] = await sql<Omit<TeamDetail, "defaults">[]>`
    select t.id::text, t.name, t.description, t.is_active,
           coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'email', p.email, 'avatar', p.avatar,
                                                         'is_lead', m.is_lead, 'is_active', p.is_active)
                                      order by m.is_lead desc, lower(p.display_name))
                     from account.team_members m join account.people p on p.id = m.person_id
                     where m.team_id = t.id and p.is_active), '[]'::jsonb) as members
    from account.teams t where t.id = ${teamId}::uuid`;
  if (!team) return null;
  // Every app with roles, except Account Center itself (never given by a team).
  const defaults = await sql<TeamDefault[]>`
    select a.key as app_key, a.name as app_name,
           (select tr.role_key from account.team_roles tr where tr.team_id = ${teamId}::uuid and tr.app_key = a.key) as role_key,
           coalesce((select jsonb_agg(jsonb_build_object('key', r.key, 'name', r.name) order by r.name)
                     from account.roles r where r.app_key = a.key), '[]'::jsonb) as roles
    from account.apps a
    where a.key <> 'account_center' and exists (select 1 from account.roles r where r.app_key = a.key)
    order by a.is_prototype, a.name`;
  return { ...team, defaults };
}

export async function activeTeams(sql: postgres.Sql): Promise<{ id: string; name: string }[]> {
  return sql<{ id: string; name: string }[]>`select id::text, name from account.teams where is_active order by lower(name)`;
}

export type TeamResult = "saved" | "invalid-name" | "taken" | "not-found" | "inactive" | "not-allowed" | "unknown-role" | "unknown-team";

function cleanName(raw: unknown): string | null {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  return name && name.length <= 60 ? name : null;
}

function cleanDescription(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
}

async function guarded<T extends string>(work: () => Promise<T>): Promise<T | "not-allowed" | "taken"> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NotAllowed) return "not-allowed";
    if ((error as { code?: string }).code === "23505") return "taken";
    throw error;
  }
}

export async function createTeam(sql: postgres.Sql, actorId: string, input: { name: unknown; description: unknown }):
  Promise<{ result: "added"; id: string } | { result: "invalid-name" | "taken" | "not-allowed" }> {
  const name = cleanName(input.name);
  if (!name) return { result: "invalid-name" };
  const description = cleanDescription(input.description);
  try {
    return await withActor(sql, actorId, async (tx) => {
      const [same] = await tx`select 1 from account.teams where lower(name) = lower(${name})`;
      if (same) return { result: "taken" } as const;
      const [row] = await tx<{ id: string }[]>`insert into account.teams (name, description) values (${name}, ${description}) returning id::text`;
      return { result: "added", id: row.id } as const;
    });
  } catch (error) {
    if (error instanceof NotAllowed) return { result: "not-allowed" };
    if ((error as { code?: string }).code === "23505") return { result: "taken" };
    throw error;
  }
}

export async function updateTeam(sql: postgres.Sql, actorId: string, teamId: string, input: { name: unknown; description: unknown }): Promise<TeamResult> {
  if (!isUuid(teamId)) return "not-found";
  const name = cleanName(input.name);
  if (!name) return "invalid-name";
  const description = cleanDescription(input.description);
  return guarded(() => withActor(sql, actorId, async (tx) => {
    const [same] = await tx`select 1 from account.teams where lower(name) = lower(${name}) and id <> ${teamId}::uuid`;
    if (same) return "taken" as const;
    const rows = await tx`update account.teams set name = ${name}, description = ${description} where id = ${teamId}::uuid returning id`;
    return rows.length ? "saved" as const : "not-found" as const;
  }));
}

// A team that is turned off gives no access and leads nobody; its members stay, so it can be turned on again.
export async function setTeamActive(sql: postgres.Sql, actorId: string, teamId: string, active: boolean): Promise<TeamResult> {
  if (!isUuid(teamId)) return "not-found";
  return guarded(() => withActor(sql, actorId, async (tx) => {
    const rows = await tx`update account.teams set is_active = ${active} where id = ${teamId}::uuid returning id`;
    return rows.length ? "saved" as const : "not-found" as const;
  }));
}

// The team's default role in one app, or none. Account Center itself is refused (the database too).
export async function setTeamRole(sql: postgres.Sql, actorId: string, teamId: string, appKey: string, roleKey: string | null): Promise<TeamResult> {
  if (!isUuid(teamId)) return "not-found";
  if (appKey === "account_center") return "unknown-role";
  return guarded(() => withActor(sql, actorId, async (tx) => {
    const [team] = await tx`select 1 from account.teams where id = ${teamId}::uuid for update`;
    if (!team) return "not-found" as const;
    if (roleKey === null) {
      await tx`delete from account.team_roles where team_id = ${teamId}::uuid and app_key = ${appKey}`;
      return "saved" as const;
    }
    const [role] = await tx`select 1 from account.roles where app_key = ${appKey} and key = ${roleKey}`;
    if (!role) return "unknown-role" as const;
    await tx`insert into account.team_roles (team_id, app_key, role_key) values (${teamId}::uuid, ${appKey}, ${roleKey})
             on conflict (team_id, app_key) do update set role_key = excluded.role_key
             where account.team_roles.role_key is distinct from excluded.role_key`;
    return "saved" as const;
  }));
}

// Put a person in a team (moving them out of their old one), or in no team. Moving ends being a lead.
export async function setPersonTeam(sql: postgres.Sql, actorId: string, personId: string, teamId: string | null, isLead = false): Promise<TeamResult> {
  if (!isUuid(personId)) return "not-found";
  if (teamId !== null && !isUuid(teamId)) return "unknown-team";
  return guarded(() => withActor(sql, actorId, async (tx) => putInTeam(tx, personId, teamId, isLead)));
}

// The same step inside a change that is already running (adding a new person).
export async function putInTeam(tx: postgres.TransactionSql, personId: string, teamId: string | null, isLead: boolean): Promise<TeamResult> {
  const [person] = await tx<{ is_active: boolean }[]>`select is_active from account.people where id = ${personId}::uuid for update`;
  if (!person) return "not-found";
  if (!person.is_active) return "inactive";
  if (teamId === null) {
    await tx`delete from account.team_members where person_id = ${personId}::uuid`;
    return "saved";
  }
  const [team] = await tx`select 1 from account.teams where id = ${teamId}::uuid and is_active`;
  if (!team) return "unknown-team";
  await tx`insert into account.team_members (person_id, team_id, is_lead) values (${personId}::uuid, ${teamId}::uuid, ${isLead})
           on conflict (person_id) do update set team_id = excluded.team_id, is_lead = excluded.is_lead
           where (account.team_members.team_id, account.team_members.is_lead) is distinct from (excluded.team_id, excluded.is_lead)`;
  return "saved";
}
