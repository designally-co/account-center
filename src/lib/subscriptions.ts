import type postgres from "postgres";
import { NotAllowed, withActor } from "./actor";
import { isUuid } from "./ids";
import { normalizeEmail } from "./people";

// Shared subscriptions (Buk, 2026-10-26): tools the company pays for, used by several people with one shared
// login (a company mailbox). Account Center keeps the tool, its shared email and who may use it, never a
// password. Every change runs through withActor, like every other change.

export type SubscriptionMember = { id: string; display_name: string; avatar: unknown; is_active: boolean };
export type Subscription = {
  id: string; name: string; shared_email: string; plan: string; url: string | null; renews_on: string | null; is_active: boolean;
  members: SubscriptionMember[];  // people who left stay listed, so the password can be changed
};

// All subscriptions, or one (by id), each with its members.
function readSubscriptions(sql: postgres.Sql, id: string | null) {
  return sql<Subscription[]>`
    select s.id::text, s.name, s.shared_email, s.plan, s.url, s.renews_on::text, s.is_active,
           coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'display_name', p.display_name, 'avatar', p.avatar, 'is_active', p.is_active)
                                      order by p.is_active desc, lower(p.display_name))
                     from account.subscription_members m join account.people p on p.id = m.person_id
                     where m.subscription_id = s.id), '[]'::jsonb) as members
    from account.subscriptions s
    where ${id}::uuid is null or s.id = ${id}::uuid
    order by s.is_active desc, lower(s.name)`;
}

export async function listSubscriptions(sql: postgres.Sql): Promise<Subscription[]> {
  return readSubscriptions(sql, null);
}

export async function getSubscription(sql: postgres.Sql, id: string): Promise<Subscription | null> {
  if (!isUuid(id)) return null;
  return (await readSubscriptions(sql, id))[0] ?? null;
}

// The shared subscriptions one person may use (their page, and Home for the person themselves).
// Home and the person page must keep working on a database that does not have the tables yet (a release
// that reached Vercel before migration 20261026100000 ran in Friday): then there is simply nothing to show.
export async function subscriptionsOf(sql: postgres.Sql, personId: string): Promise<Omit<Subscription, "members">[]> {
  if (!isUuid(personId)) return [];
  try {
    return await sql<Omit<Subscription, "members">[]>`
      select s.id::text, s.name, s.shared_email, s.plan, s.url, s.renews_on::text, s.is_active
      from account.subscription_members m join account.subscriptions s on s.id = m.subscription_id
      where m.person_id = ${personId}::uuid
      order by s.is_active desc, lower(s.name)`;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return [];  // undefined_table
    throw error;
  }
}

// Active people who are not on this subscription yet, for the "Add someone" list.
export async function candidatesFor(sql: postgres.Sql, id: string): Promise<{ id: string; display_name: string }[]> {
  if (!isUuid(id)) return [];
  return sql<{ id: string; display_name: string }[]>`
    select p.id::text, p.display_name from account.people p
    where p.is_active and not exists (select 1 from account.subscription_members m where m.subscription_id = ${id}::uuid and m.person_id = p.id)
    order by lower(p.display_name)`;
}

export type SubscriptionInput = { name: unknown; shared_email: unknown; plan: unknown; url: unknown; renews_on: unknown };
type Clean = { name: string; shared_email: string; plan: string; url: string | null; renews_on: string | null };
export type SubscriptionResult =
  | "saved" | "invalid-name" | "invalid-email" | "invalid-plan" | "invalid-url" | "invalid-date"
  | "taken" | "not-found" | "not-allowed" | "inactive-person" | "already-member" | "not-member";

function clean(input: SubscriptionInput): Clean | Exclude<SubscriptionResult, "saved"> {
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) return "invalid-name";
  const shared_email = normalizeEmail(input.shared_email);
  if (!shared_email || shared_email.length > 320) return "invalid-email";
  const plan = String(input.plan ?? "").trim().replace(/\s+/g, " ");
  if (plan.length > 60) return "invalid-plan";
  const rawUrl = String(input.url ?? "").trim();
  let url: string | null = null;
  if (rawUrl) {
    try {
      const u = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
      if (u.protocol !== "https:" || u.username || u.password) return "invalid-url";
      url = `https://${u.hostname.toLowerCase()}${u.pathname === "/" ? "" : u.pathname}`;
      if (url.length > 300 || !/^https:\/\/[a-z0-9.-]+(\/[^\s]*)?$/.test(url)) return "invalid-url";
    } catch {
      return "invalid-url";
    }
  }
  const rawDate = String(input.renews_on ?? "").trim();
  const renews_on = rawDate || null;
  if (renews_on && (!/^\d{4}-\d{2}-\d{2}$/.test(renews_on) || Number.isNaN(Date.parse(`${renews_on}T00:00:00Z`)))) return "invalid-date";
  return { name, shared_email, plan, url, renews_on };
}

function refused(error: unknown): "not-allowed" | "taken" {
  if (error instanceof NotAllowed) return "not-allowed";
  if ((error as { code?: string }).code === "23505") return "taken";
  throw error;
}

export async function createSubscription(sql: postgres.Sql, actorId: string, input: SubscriptionInput):
  Promise<{ result: "added"; id: string } | { result: Exclude<SubscriptionResult, "saved"> }> {
  const c = clean(input);
  if (typeof c === "string") return { result: c };
  try {
    return await withActor(sql, actorId, async (tx) => {
      const [same] = await tx`select 1 from account.subscriptions where lower(name) = lower(${c.name})`;
      if (same) return { result: "taken" } as const;
      const [row] = await tx<{ id: string }[]>`
        insert into account.subscriptions (name, shared_email, plan, url, renews_on)
        values (${c.name}, ${c.shared_email}, ${c.plan}, ${c.url}, ${c.renews_on}) returning id::text`;
      return { result: "added", id: row.id } as const;
    });
  } catch (error) {
    return { result: refused(error) };
  }
}

export async function updateSubscription(sql: postgres.Sql, actorId: string, id: string, input: SubscriptionInput): Promise<SubscriptionResult> {
  if (!isUuid(id)) return "not-found";
  const c = clean(input);
  if (typeof c === "string") return c;
  try {
    return await withActor(sql, actorId, async (tx) => {
      const [same] = await tx`select 1 from account.subscriptions where lower(name) = lower(${c.name}) and id <> ${id}::uuid`;
      if (same) return "taken" as const;
      const rows = await tx`
        update account.subscriptions set name = ${c.name}, shared_email = ${c.shared_email}, plan = ${c.plan}, url = ${c.url}, renews_on = ${c.renews_on}
        where id = ${id}::uuid returning id`;
      return rows.length ? "saved" as const : "not-found" as const;
    });
  } catch (error) {
    return refused(error);
  }
}

export async function setSubscriptionActive(sql: postgres.Sql, actorId: string, id: string, active: boolean): Promise<SubscriptionResult> {
  if (!isUuid(id)) return "not-found";
  try {
    return await withActor(sql, actorId, async (tx) => {
      const rows = await tx`update account.subscriptions set is_active = ${active} where id = ${id}::uuid returning id`;
      return rows.length ? "saved" as const : "not-found" as const;
    });
  } catch (error) {
    return refused(error);
  }
}

// Only active people are added. Anyone can be taken off, also someone who left (after the password changed).
export async function addSubscriptionMember(sql: postgres.Sql, actorId: string, id: string, personId: string): Promise<SubscriptionResult> {
  if (!isUuid(id) || !isUuid(personId)) return "not-found";
  try {
    return await withActor(sql, actorId, async (tx) => {
      const [sub] = await tx`select 1 from account.subscriptions where id = ${id}::uuid for update`;
      if (!sub) return "not-found" as const;
      const [person] = await tx<{ is_active: boolean }[]>`select is_active from account.people where id = ${personId}::uuid for share`;
      if (!person) return "not-found" as const;
      if (!person.is_active) return "inactive-person" as const;
      const rows = await tx`insert into account.subscription_members (subscription_id, person_id) values (${id}::uuid, ${personId}::uuid)
                            on conflict do nothing returning person_id`;
      return rows.length ? "saved" as const : "already-member" as const;
    });
  } catch (error) {
    return refused(error);
  }
}

export async function removeSubscriptionMember(sql: postgres.Sql, actorId: string, id: string, personId: string): Promise<SubscriptionResult> {
  if (!isUuid(id) || !isUuid(personId)) return "not-found";
  try {
    return await withActor(sql, actorId, async (tx) => {
      const rows = await tx`delete from account.subscription_members where subscription_id = ${id}::uuid and person_id = ${personId}::uuid returning person_id`;
      return rows.length ? "saved" as const : "not-member" as const;
    });
  } catch (error) {
    return refused(error);
  }
}
