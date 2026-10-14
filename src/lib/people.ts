import type postgres from "postgres";
import { withActor } from "./actor";

export type LoginState = "ok" | "blocked" | "missing";

export type PersonRow = {
  id: string;
  display_name: string;
  email: string;
  source: "hr" | "account_center";
  is_active: boolean;
  login: LoginState;
  work_emails: string[];
  role_count: number;
};

export async function listPeople(sql: postgres.Sql): Promise<PersonRow[]> {
  return sql<PersonRow[]>`
    select p.id, p.display_name, p.email, p.source, p.is_active,
           account.login_state(p.auth_user_id) as login,
           coalesce(array(select e.email from account.person_emails e where e.person_id = p.id order by e.email), '{}') as work_emails,
           (select count(*)::int from account.grants g where g.person_id = p.id) as role_count
    from account.people p
    order by p.is_active desc, lower(p.display_name)`;
}

// One simple shape check; the database checks again (lower case, no spaces, an @).
export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export type AddEmailResult = "added" | "invalid" | "taken" | "main-email-of-another" | "no-person";

export async function addWorkEmail(sql: postgres.Sql, actorId: string, personId: string, rawEmail: unknown): Promise<AddEmailResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid";
  try {
    await withActor(sql, actorId, (tx) => tx`insert into account.person_emails (email, person_id) values (${email}, ${personId}::uuid)`);
    return "added";
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return "taken";                 // already someone's work email
    if (code === "P0001") return "main-email-of-another"; // another person's HR email (account.check_person_email)
    if (code === "23503" || code === "22P02") return "no-person";
    throw error;
  }
}

export async function removeWorkEmail(sql: postgres.Sql, actorId: string, personId: string, email: string): Promise<boolean> {
  const rows = await withActor(sql, actorId, (tx) =>
    tx`delete from account.person_emails where email = ${email} and person_id = ${personId}::uuid returning email`);
  return rows.length === 1;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type RemoveResult = "removed" | "not-found" | "yourself";

// Someone left: every role is taken away and the person is marked inactive, in one logged change.
// The record and its history stay. Blocking the login (so HR and every app follow) is the
// account-remove server function, added with account creation (it writes Friday's Auth).
export async function removePerson(sql: postgres.Sql, actorId: string, personId: string): Promise<RemoveResult> {
  if (personId === actorId) return "yourself";
  if (!isUuid(personId)) return "not-found";
  return withActor(sql, actorId, async (tx) => {
    const found = await tx`update account.people set is_active = false where id = ${personId}::uuid and is_active returning id`;
    if (found.length !== 1) return "not-found";
    await tx`delete from account.grants where person_id = ${personId}::uuid`;
    return "removed";
  });
}
