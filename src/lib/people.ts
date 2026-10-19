import type postgres from "postgres";
import { NotAllowed, withActor } from "./actor";
import { isUuid, sameId } from "./ids";

export type LoginState = "ok" | "blocked" | "missing";

export type PersonRow = {
  id: string;
  display_name: string;
  email: string;
  source: "hr" | "account_center";
  kind: string;
  is_active: boolean;
  login: LoginState;
  work_emails: string[];
  avatar: unknown;                       // the person's avatar choices, or null before they make one
  app_count: number;                     // apps where the real check gives at least one action
};

export async function listPeople(sql: postgres.Sql): Promise<PersonRow[]> {
  return sql<PersonRow[]>`
    select p.id, p.display_name, p.email, p.source, k.name as kind, p.is_active, p.avatar,
           account.login_state(p.auth_user_id) as login,
           coalesce(array(select e.email from account.person_emails e where e.person_id = p.id order by e.email), '{}') as work_emails,
           (select count(distinct a.app_key)::int
            from account.actions a
            where not exists (select 1 from account.kind_blocked_apps b where b.kind = p.kind and b.app_key = a.app_key)
              and coalesce(
                    (select x.allowed from account.person_actions x where x.person_id = p.id and x.action_key = a.key),
                    exists (select 1 from account.grants g
                            join account.role_actions ra on ra.app_key = g.app_key and ra.role_key = g.role_key
                            where g.person_id = p.id and ra.action_key = a.key))) as app_count
    from account.people p
    join account.kinds k on k.key = p.kind
    order by p.is_active desc, lower(p.display_name)`;
}

// One simple shape check; the database checks again (lower case, no spaces, an @).
export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export type AddEmailResult = "added" | "invalid" | "taken" | "main-email-of-another" | "no-person" | "not-allowed";

export async function addWorkEmail(sql: postgres.Sql, actorId: string, personId: string, rawEmail: unknown): Promise<AddEmailResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid";
  try {
    await withActor(sql, actorId, (tx) => tx`insert into account.person_emails (email, person_id) values (${email}, ${personId}::uuid)`);
    return "added";
  } catch (error) {
    if (error instanceof NotAllowed) return "not-allowed";
    const code = (error as { code?: string }).code;
    if (code === "23505") return "taken";                 // already someone's work email
    if (code === "P0001") return "main-email-of-another"; // another person's HR email (account.check_person_email)
    if (code === "23503" || code === "22P02") return "no-person";
    throw error;
  }
}

export type RemoveEmailResult = "removed" | "not-found" | "not-allowed";

export async function removeWorkEmail(sql: postgres.Sql, actorId: string, personId: string, email: string): Promise<RemoveEmailResult> {
  if (!isUuid(personId)) return "not-found";
  try {
    const rows = await withActor(sql, actorId, (tx) =>
      tx`delete from account.person_emails where email = ${email} and person_id = ${personId}::uuid returning email`);
    return rows.length === 1 ? "removed" : "not-found";
  } catch (error) {
    if (error instanceof NotAllowed) return "not-allowed";
    throw error;
  }
}

export type RemoveResult = "removed" | "not-found" | "yourself" | "not-allowed";

// Someone left: every role and every single change is taken away and the person is marked inactive,
// in one logged change.
// The record and its history stay. Blocking the login (so HR and every app follow) is the
// account-remove server function, added with account creation (it writes Friday's Auth).
export async function removePerson(sql: postgres.Sql, actorId: string, personId: string): Promise<RemoveResult> {
  if (!isUuid(personId)) return "not-found";
  if (sameId(personId, actorId)) return "yourself";
  try {
    return await withActor(sql, actorId, async (tx) => {
      const found = await tx`update account.people set is_active = false where id = ${personId}::uuid and is_active returning id`;
      if (found.length !== 1) return "not-found" as const;
      await tx`delete from account.grants where person_id = ${personId}::uuid`;
      await tx`delete from account.person_actions where person_id = ${personId}::uuid`;
      return "removed" as const;
    });
  } catch (error) {
    if (error instanceof NotAllowed) return "not-allowed";
    throw error;
  }
}
