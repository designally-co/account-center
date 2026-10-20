import { createHash } from "node:crypto";
import type postgres from "postgres";
import { NotAllowed, withActor } from "./actor";
import { isUuid, sameId } from "./ids";
import type { LoginState } from "./people";

// A person's access list: per app, a ready role, plus exceptions for that one person.
// The database decides the final answer (account.person_can); this file only reads and saves the list.

export type Kind = { key: string; name: string; description: string };

export type ActionState = {
  key: string;
  description: string;
  inRole: boolean;                       // the person's ready role in this app includes it
  exception: "added" | "taken-away" | null;
  on: boolean;                           // role plus or minus the exception (before the kind and login are checked)
};

export type AppAccess = {
  key: string;
  name: string;
  description: string;                   // one sentence about the app (account.apps.description)
  isPrototype: boolean;
  hue: number | null;                    // the app's colour on screen (account.apps.hue)
  url: string | null;                    // where the app opens (account.apps.url)
  icon: string | null;                   // the app's own graphic (account.apps.icon)
  art: string | null;                    // a small picture of what the app does, for Home (account.apps.art)
  keptOut: boolean;                      // the person's kind may never use this app
  roles: { key: string; name: string; description: string; actions: string[] }[];  // TEAM_ROLE first, when the team gives one
  roleKeys: string[];                    // the person's own ready roles here (normally one)
  team: { name: string; roleName: string } | null;  // the default role the person's team gives in this app
  baseKey: string;                       // what the person's access starts from: their own role, TEAM_ROLE, or "" (none)
  allByAdmin: boolean;                   // an Account Center admin has every action in every other app
  actions: ActionState[];
  version: string;                       // changes whenever anything above changes; a save from an older page is refused
};

// In a person's app panel, "the team's default role" is one more choice next to the app's own roles.
export const TEAM_ROLE = "@team";

export type PersonAccess = {
  id: string;
  display_name: string;
  email: string;
  kind: string;
  source: "hr" | "account_center";
  is_active: boolean;
  login: LoginState;
  work_emails: string[];
  avatar: unknown;
  team: { id: string; name: string; is_active: boolean; is_lead: boolean } | null;  // one team at most
  apps: AppAccess[];
};

export async function listKinds(sql: postgres.Sql): Promise<Kind[]> {
  return sql<Kind[]>`select key, name, description from account.kinds order by key = 'employee' desc, name`;
}

function versionOf(app: Omit<AppAccess, "version">): string {
  const state = [app.keptOut, app.roles, app.roleKeys, app.team, app.baseKey, app.allByAdmin, app.actions.map((a) => [a.key, a.on, a.exception])];
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 32);
}

// Every app (or one app) with its roles, the person's roles and each action's state for this person.
// Always inside a transaction, so the four reads (and the version made from them) agree.
async function readApps(sql: postgres.TransactionSql, personId: string, kind: string, onlyApp: string | null): Promise<AppAccess[]> {
  const apps = await sql<{ key: string; name: string; description: string; is_prototype: boolean; hue: number | null; url: string | null; icon: string | null; art: string | null; kept_out: boolean }[]>`
    select a.key, a.name, a.description, a.is_prototype, a.hue, a.url, a.icon, a.art,
           exists (select 1 from account.kind_blocked_apps b where b.kind = ${kind} and b.app_key = a.key) as kept_out
    from account.apps a
    where ${onlyApp}::text is null or a.key = ${onlyApp}
    order by a.key = 'account_center' desc, a.is_prototype, a.name`;
  const roles = await sql<{ app_key: string; key: string; name: string; description: string; actions: string[] }[]>`
    select r.app_key, r.key, r.name, r.description,
           array(select ra.action_key from account.role_actions ra
                 where ra.app_key = r.app_key and ra.role_key = r.key order by ra.action_key) as actions
    from account.roles r
    where ${onlyApp}::text is null or r.app_key = ${onlyApp}
    order by r.app_key, r.name`;
  const grants = await sql<{ app_key: string; role_key: string }[]>`
    select app_key, role_key from account.grants
    where person_id = ${personId}::uuid and (${onlyApp}::text is null or app_key = ${onlyApp})
    order by app_key, role_key`;
  const teamRoles = await sql<{ app_key: string; role_key: string; team_name: string }[]>`
    select tr.app_key, tr.role_key, t.name as team_name
    from account.team_members m
    join account.teams t on t.id = m.team_id and t.is_active
    join account.team_roles tr on tr.team_id = m.team_id
    where m.person_id = ${personId}::uuid and (${onlyApp}::text is null or tr.app_key = ${onlyApp})`;
  const [{ is_admin: isAdmin }] = await sql<{ is_admin: boolean }[]>`
    select exists (select 1 from account.grants where person_id = ${personId}::uuid and app_key = 'account_center' and role_key = 'admin') as is_admin`;
  const optOuts = await sql<{ app_key: string }[]>`
    select app_key from account.team_opt_outs
    where person_id = ${personId}::uuid and (${onlyApp}::text is null or app_key = ${onlyApp})`;
  const actions = await sql<{ app_key: string; key: string; description: string; allowed: boolean | null }[]>`
    select a.app_key, a.key, a.description,
           (select x.allowed from account.person_actions x where x.person_id = ${personId}::uuid and x.action_key = a.key) as allowed
    from account.actions a
    where ${onlyApp}::text is null or a.app_key = ${onlyApp}
    order by a.app_key, a.key`;

  return apps.map((app) => {
    // Where access starts (the same rule as account.base_allows): the person's own role in this app; else,
    // unless an admin chose "no access" here, the team's default role.
    const appRoles = roles.filter((r) => r.app_key === app.key).map(({ key, name, description, actions }) => ({ key, name, description, actions }));
    const roleKeys = grants.filter((g) => g.app_key === app.key).map((g) => g.role_key);
    const teamRow = teamRoles.find((t) => t.app_key === app.key);
    const teamRole = teamRow ? appRoles.find((r) => r.key === teamRow.role_key) : undefined;
    const team = teamRow && teamRole ? { name: teamRow.team_name, roleName: teamRole.name } : null;
    const optedOut = optOuts.some((o) => o.app_key === app.key);
    const baseKey = roleKeys.length ? roleKeys[0] : !optedOut && team ? TEAM_ROLE : "";
    const allByAdmin = isAdmin && app.key !== "account_center";
    const base = new Set(allByAdmin ? actions.filter((a) => a.app_key === app.key).map((a) => a.key) : roleKeys.length
      ? appRoles.filter((r) => roleKeys.includes(r.key)).flatMap((r) => r.actions)
      : baseKey === TEAM_ROLE ? teamRole!.actions : []);
    const access: Omit<AppAccess, "version"> = {
      key: app.key,
      name: app.name,
      description: app.description,
      isPrototype: app.is_prototype,
      hue: app.hue,
      url: app.url,
      icon: app.icon,
      art: app.art,
      keptOut: app.kept_out,
      roles: team && teamRole
        ? [{ key: TEAM_ROLE, name: `${team.roleName} (${team.name} default)`, description: teamRole.description, actions: teamRole.actions }, ...appRoles]
        : appRoles,
      roleKeys,
      team,
      baseKey,
      allByAdmin,
      actions: actions.filter((a) => a.app_key === app.key).map((a) => ({
        key: a.key,
        description: a.description,
        inRole: base.has(a.key),
        exception: a.allowed === true ? "added" : a.allowed === false ? "taken-away" : null,
        on: a.allowed ?? base.has(a.key),
      })),
    };
    return { ...access, version: versionOf(access) };
  });
}

export async function getPersonAccess(sql: postgres.Sql, personId: string): Promise<PersonAccess | null> {
  if (!isUuid(personId)) return null;
  const [person] = await sql<Omit<PersonAccess, "apps">[]>`
    select p.id, p.display_name, p.email, p.kind, p.source, p.is_active, p.avatar, account.login_state(p.auth_user_id) as login,
           coalesce(array(select e.email from account.person_emails e where e.person_id = p.id order by e.email), '{}') as work_emails,
           (select jsonb_build_object('id', t.id, 'name', t.name, 'is_active', t.is_active, 'is_lead', m.is_lead)
            from account.team_members m join account.teams t on t.id = m.team_id where m.person_id = p.id) as team
    from account.people p where p.id = ${personId}::uuid`;
  if (!person) return null;
  const apps = await sql.begin("read only isolation level repeatable read",
    (tx) => readApps(tx, personId, person.kind, null)) as AppAccess[];
  return { ...person, apps };
}

// One short summary per app, for a closed row and for "Your access".
export function accessSummary(app: AppAccess, kindName: string): { text: string; tone: "ok" | "muted" | "warn"; on: number } {
  const on = app.keptOut ? 0 : app.actions.filter((a) => a.on).length;
  if (app.keptOut) return { text: `Never for ${kindName}`, tone: "warn", on };
  if (on === 0) return { text: "No access", tone: "muted", on };
  if (app.allByAdmin) return { text: `Admin · every action`, tone: "ok", on };
  const role = app.baseKey === TEAM_ROLE && app.team ? `${app.team.roleName} (team)` : app.roles.filter((r) => app.roleKeys.includes(r.key)).map((r) => r.name).join(", ");
  const changed = app.actions.some((a) => a.exception !== null);
  const label = role ? `${role}${changed ? " + changes" : ""}` : "Single actions";
  return { text: `${label} · ${on} of ${app.actions.length}`, tone: "ok", on };
}

export type SaveResult =
  | "saved" | "not-found" | "inactive" | "yourself" | "kept-out" | "changed" | "not-allowed" | "manage-needs-view"
  | "unknown-role" | "unknown-app" | "unknown-kind";

// The database refuses access that a kind may never have (account.check_access_allowed_for_kind, code AC001)
// and a change of kind while such access exists (account.check_kind_change, code AC002).
function refusal(error: unknown): SaveResult | null {
  if (error instanceof NotAllowed) return "not-allowed";
  const code = (error as { code?: string }).code;
  if (code === "AC001" || code === "AC002") return "kept-out";
  if (code === "23503") return "unknown-kind";
  return null;
}

// Locks the person for the rest of the change, so nothing else changes them meanwhile.
async function lockPerson(tx: postgres.TransactionSql, personId: string): Promise<{ kind: string } | "not-found" | "inactive"> {
  const [row] = await tx<{ is_active: boolean; kind: string }[]>`
    select is_active, kind from account.people where id = ${personId}::uuid for update`;
  if (!row) return "not-found";
  return row.is_active ? { kind: row.kind } : "inactive";
}

// Runs one change to one app of one person's list, after the checks every such change needs:
// the person exists and is active, the app exists, and the page was built from the list as it is now.
// A save from an older page that asks for exactly what is stored now (for example the same save sent twice)
// is simply done: `sameAsNow` says so, and nothing is written.
async function changeApp(
  sql: postgres.Sql, actorId: string, personId: string, appKey: string, version: string,
  work: (tx: postgres.TransactionSql, app: AppAccess) => Promise<SaveResult>,
  sameAsNow?: (app: AppAccess) => boolean,
): Promise<SaveResult> {
  if (!isUuid(personId)) return "not-found";
  // Nobody changes their own Account Center access, so an admin cannot lock themselves out by mistake.
  if (sameId(personId, actorId) && appKey === "account_center") return "yourself";
  try {
    return await withActor(sql, actorId, async (tx) => {
      const person = await lockPerson(tx, personId);
      if (typeof person === "string") return person;
      const [app] = await readApps(tx, personId, person.kind, appKey);
      if (!app) return "unknown-app";
      if (app.version !== version) return sameAsNow?.(app) ? "saved" : "changed";
      return work(tx, app);
    });
  } catch (error) {
    const r = refusal(error);
    if (r) return r;
    throw error;
  }
}

// Save one app of a person's list in one go: the ready role (or none), then the ticked actions. Only the
// differences between the ticks and that role are stored, as single changes for this person. `ticked` null
// means "exactly the role" (no single changes). Keys that are not this app's actions are ignored.
// Choosing no role and no ticks also clears access left over in an app the person's kind is kept out of.
// The role can be TEAM_ROLE (the team's default, when the team gives one here); a role of their own replaces
// it, and "no role" while the team gives one is stored as "no access here" (account.team_opt_outs).
export async function saveAppAccess(
  sql: postgres.Sql, actorId: string, personId: string, appKey: string,
  roleKey: string | null, ticked: string[] | null, version: string,
): Promise<SaveResult> {
  // What each action would be after this save: the role, or the ticks when they were made for this role.
  const finalOn = (app: AppAccess, key: string) => {
    const role = roleKey === null ? null : app.roles.find((r) => r.key === roleKey);
    return ticked === null ? role?.actions.includes(key) ?? false : ticked.includes(key);
  };
  const sameAsNow = (app: AppAccess) =>
    app.baseKey === (roleKey ?? "") && app.roleKeys.length <= 1 && app.actions.every((a) => a.on === finalOn(app, a.key));
  return changeApp(sql, actorId, personId, appKey, version, async (tx, app) => {
    const role = roleKey === null ? null : app.roles.find((r) => r.key === roleKey);
    if (role === undefined) return "unknown-role";
    // Someone who could manage Account Center without seeing it could act unseen, and would not count as an
    // admin for the way back (account.bootstrap_first_admin), so that list is refused.
    if (appKey === "account_center" && finalOn(app, "account_center.manage") && !finalOn(app, "account_center.view")) return "manage-needs-view";
    const own = role && role.key !== TEAM_ROLE ? role.key : null;
    await tx`delete from account.grants where person_id = ${personId}::uuid and app_key = ${appKey}
             and (${own}::text is null or role_key <> ${own})`;
    if (role === null && app.team) {
      await tx`insert into account.team_opt_outs (person_id, app_key) values (${personId}::uuid, ${appKey}) on conflict do nothing`;
    } else {
      await tx`delete from account.team_opt_outs where person_id = ${personId}::uuid and app_key = ${appKey}`;
    }
    if (role && own) {
      await tx`insert into account.grants (person_id, app_key, role_key) values (${personId}::uuid, ${appKey}, ${role.key})
               on conflict do nothing`;
    }
    for (const a of app.actions) {
      const inRole = role?.actions.includes(a.key) ?? false;
      const on = ticked === null ? inRole : ticked.includes(a.key);
      if (on === inRole) {
        await tx`delete from account.person_actions where person_id = ${personId}::uuid and action_key = ${a.key}`;
      } else {
        await tx`insert into account.person_actions (person_id, action_key, allowed) values (${personId}::uuid, ${a.key}, ${on})
                 on conflict (person_id, action_key) do update set allowed = excluded.allowed
                 where account.person_actions.allowed is distinct from excluded.allowed`;
      }
    }
    return "saved";
  }, sameAsNow);
}

export type KindResult = { result: SaveResult | "kind-blocked"; app?: string };

// Change a person's kind. Refused while they still have access to an app the new kind is kept out of:
// the answer names that app, so the admin can remove that access first.
export async function setKind(sql: postgres.Sql, actorId: string, personId: string, kind: string): Promise<KindResult> {
  if (!isUuid(personId)) return { result: "not-found" };
  // Your own kind decides which apps you may ever use, so another admin changes it.
  if (sameId(personId, actorId)) return { result: "yourself" };
  try {
    return await withActor(sql, actorId, async (tx) => {
      const person = await lockPerson(tx, personId);
      if (typeof person === "string") return { result: person };
      const [blocked] = await tx<{ key: string }[]>`
        select a.key from account.apps a
        join account.kind_blocked_apps b on b.app_key = a.key and b.kind = ${kind}
        where exists (select 1 from account.grants g where g.person_id = ${personId}::uuid and g.app_key = a.key)
           or exists (select 1 from account.person_actions x join account.actions ac on ac.key = x.action_key
                      where x.person_id = ${personId}::uuid and x.allowed and ac.app_key = a.key)
        order by a.name limit 1`;
      if (blocked) return { result: "kind-blocked" as const, app: blocked.key };
      await tx`update account.people set kind = ${kind} where id = ${personId}::uuid and kind is distinct from ${kind}`;
      return { result: "saved" as const };
    });
  } catch (error) {
    const r = refusal(error);
    if (r) return { result: r };
    throw error;
  }
}
