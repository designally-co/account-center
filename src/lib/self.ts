import type postgres from "postgres";
import { parseAvatar } from "./avatar";

// Changes a person makes for themselves. Not an admin change, so it does not go through withActor: it needs
// only the signed-in account of an active person, and it can change nothing but that person's own avatar.

export type AvatarResult = "saved" | "invalid" | "no-person";

export async function saveMyAvatar(sql: postgres.Sql, authUserId: string, raw: unknown): Promise<AvatarResult> {
  const choice = parseAvatar(raw);
  if (!choice) return "invalid";
  return (await sql.begin(async (tx) => {
    // Empty for a removed person or a blocked login, so they cannot change anything.
    const [row] = await tx<{ me: { person_id: string } | null }[]>`select account.me_by_user(${authUserId}::uuid) as me`;
    const personId = row?.me?.person_id;
    if (!personId) return "no-person";
    await tx`select set_config('account.actor', ${personId}, true)`;
    await tx`update account.people set avatar = ${tx.json(choice)} where id = ${personId}::uuid`;
    return "saved";
  })) as AvatarResult;
}
