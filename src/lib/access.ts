import type postgres from "postgres";

// Account Center asks its own schema the same questions every app asks.
// The answers come from the database functions in schema `account`, which fail closed.

export type Me = {
  person_id: string;
  display_name: string;
  roles: { app: string; role: string }[];
};

export async function canUser(sql: postgres.Sql, authUserId: string, action: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean | null }[]>`select account.can_user(${authUserId}::uuid, ${action}) as ok`;
  return row?.ok === true;
}

export async function meByUser(sql: postgres.Sql, authUserId: string): Promise<Me | null> {
  const [row] = await sql<{ me: Me | null }[]>`select account.me_by_user(${authUserId}::uuid) as me`;
  return row?.me ?? null;
}

// The actions of Account Center itself (schema migration, table account.actions).
export const ACTIONS = {
  view: "account_center.view",
  manage: "account_center.manage",
} as const;
