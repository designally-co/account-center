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

// Teams are never turned off from the app (Buk, 2026-11-03: "team must not be turned off"), so there is no
// action for it. The database still knows a team that is off (it gives nothing), for safety.

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

// A person has one primary team (shown under their name) and any number of extra teams (Buk, 2026-11-03:
// "each person can have primary team and extra team"). Every team they are in gives its default access; the
// database keeps exactly one primary team for anyone in a team (migration 20261103100000).

// The person's page: their primary team and whether they lead it. Choosing another team moves the primary
// there (the old primary team is left; if the new one was an extra team, it simply becomes the primary).
// "No team" takes them off every team, extra teams too.
export async function setPersonTeam(sql: postgres.Sql, actorId: string, personId: string, teamId: string | null, isLead = false): Promise<TeamResult> {
  if (!isUuid(personId)) return "not-found";
  if (teamId !== null && !isUuid(teamId)) return "unknown-team";
  return guarded(() => withActor(sql, actorId, async (tx) => putInTeam(tx, personId, teamId, isLead)));
}

// The person's page: their extra teams, as a whole list. Their primary team is never in it, and a person
// with no primary team gets no extra team (the page offers extra teams only after a primary one).
export async function setExtraTeams(sql: postgres.Sql, actorId: string, personId: string, teamIds: string[]): Promise<TeamResult | "no-primary"> {
  if (!isUuid(personId)) return "not-found";
  if (!teamIds.every(isUuid)) return "unknown-team";
  const wanted = [...new Set(teamIds.map((id) => id.toLowerCase()))];
  return guarded(() => withActor(sql, actorId, async (tx) => {
    const person = await lockPerson(tx, personId);
    if (person !== "ok") return person;
    const [primary] = await tx<{ team_id: string }[]>`
      select team_id::text from account.team_members where person_id = ${personId}::uuid and is_primary`;
    if (!primary) return wanted.length ? "no-primary" as const : "saved" as const;
    const extras = wanted.filter((id) => id !== primary.team_id);
    if (extras.length) {
      const found = await tx`select id from account.teams where id = any(${extras}::uuid[]) and is_active`;
      if (found.length !== extras.length) return "unknown-team" as const;
    }
    await tx`delete from account.team_members
             where person_id = ${personId}::uuid and not is_primary and not (team_id = any(${extras}::uuid[]))`;
    for (const id of extras) {
      await tx`insert into account.team_members (person_id, team_id, is_primary) values (${personId}::uuid, ${id}::uuid, false)
               on conflict (person_id, team_id) do nothing`;
    }
    return "saved" as const;
  }));
}

// From a team's popup on the Teams page: tick someone to add them to this team, untick to take them off.
// Someone already in another team gets this one as an extra team; someone in no team gets it as their
// primary team (Buk, 2026-11-03). Ticking someone already in the team changes nothing, so a lead stays a lead.
// Taking off removes them from THIS team only; if it was their primary team, their oldest other team becomes
// their primary team.
export async function addToTeam(sql: postgres.Sql, actorId: string, personId: string, teamId: string): Promise<TeamResult> {
  if (!isUuid(personId)) return "not-found";
  if (!isUuid(teamId)) return "unknown-team";
  return guarded(() => withActor(sql, actorId, async (tx) => {
    const person = await lockPerson(tx, personId);
    if (person !== "ok") return person;
    const [here] = await tx`select 1 from account.team_members where person_id = ${personId}::uuid and team_id = ${teamId}::uuid`;
    if (here) return "saved" as const;
    const [team] = await tx`select 1 from account.teams where id = ${teamId}::uuid and is_active`;
    if (!team) return "unknown-team" as const;
    const [hasPrimary] = await tx`select 1 from account.team_members where person_id = ${personId}::uuid and is_primary`;
    await tx`insert into account.team_members (person_id, team_id, is_primary) values (${personId}::uuid, ${teamId}::uuid, ${!hasPrimary})`;
    return "saved" as const;
  }));
}

export async function takeOffTeam(sql: postgres.Sql, actorId: string, personId: string, teamId: string): Promise<TeamResult> {
  if (!isUuid(personId) || !isUuid(teamId)) return "not-found";
  return guarded(() => withActor(sql, actorId, async (tx) => {
    await tx`select 1 from account.people where id = ${personId}::uuid for update`;
    const [gone] = await tx<{ is_primary: boolean }[]>`
      delete from account.team_members where person_id = ${personId}::uuid and team_id = ${teamId}::uuid returning is_primary`;
    if (gone?.is_primary) await promoteOldest(tx, personId);
    return "saved" as const;
  }));
}

// The same step as setPersonTeam inside a change that is already running (adding a new person).
export async function putInTeam(tx: postgres.TransactionSql, personId: string, teamId: string | null, isLead: boolean): Promise<TeamResult> {
  const person = await lockPerson(tx, personId);
  if (person !== "ok") return person;
  if (teamId === null) {
    await tx`delete from account.team_members where person_id = ${personId}::uuid`;
    return "saved";
  }
  const [team] = await tx`select 1 from account.teams where id = ${teamId}::uuid and is_active`;
  if (!team) return "unknown-team";
  // The old primary team is left first, so the unique "one primary" rule never sees two.
  await tx`delete from account.team_members where person_id = ${personId}::uuid and is_primary and team_id <> ${teamId}::uuid`;
  await tx`insert into account.team_members (person_id, team_id, is_lead, is_primary) values (${personId}::uuid, ${teamId}::uuid, ${isLead}, true)
           on conflict (person_id, team_id) do update set is_lead = excluded.is_lead, is_primary = true
           where (account.team_members.is_lead, account.team_members.is_primary) is distinct from (excluded.is_lead, true)`;
  return "saved";
}

// One change at a time per person; a removed person's teams are never changed.
async function lockPerson(tx: postgres.TransactionSql, personId: string): Promise<"ok" | "not-found" | "inactive"> {
  const [person] = await tx<{ is_active: boolean }[]>`select is_active from account.people where id = ${personId}::uuid for update`;
  if (!person) return "not-found";
  return person.is_active ? "ok" : "inactive";
}

// After a person left their primary team: their oldest other team becomes the primary one.
async function promoteOldest(tx: postgres.TransactionSql, personId: string) {
  await tx`update account.team_members set is_primary = true
           where person_id = ${personId}::uuid
             and team_id = (select m.team_id from account.team_members m join account.teams t on t.id = m.team_id
                            where m.person_id = ${personId}::uuid
                            order by m.created_at, lower(t.name) limit 1)`;
}
