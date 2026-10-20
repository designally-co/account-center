import type postgres from "postgres";
import { parseAvatar } from "./avatar";

// Changes a person makes for themselves. Not an admin change, so it does not go through withActor: it needs
// only the signed-in account of an active person, and it can change nothing but that person's own avatar.

// Set by "Later" on the first-sign-in avatar step: that browser skips the step from then on.
export const AVATAR_LATER_COOKIE = "ac_avatar_later";

export type AvatarResult = "saved" | "invalid" | "no-person" | "wait";

export async function saveMyAvatar(sql: postgres.Sql, authUserId: string, raw: unknown): Promise<AvatarResult> {
  const choice = parseAvatar(raw);
  if (!choice) return "invalid";
  return (await sql.begin(async (tx) => {
    // Empty for a removed person or a blocked login, so they cannot change anything.
    const [row] = await tx<{ me: { person_id: string } | null }[]>`select account.me_by_user(${authUserId}::uuid) as me`;
    const personId = row?.me?.person_id;
    if (!personId) return "no-person";
    // Written only when the avatar really changes, and at most once every few seconds per person, so nobody
    // can fill the change log by pressing Save again and again.
    const [now] = await tx<{ same: boolean; recent: boolean }[]>`
      select p.avatar is not distinct from ${tx.json(choice)}::jsonb as same,
             exists (select 1 from account.log l
                     where l.actor = ${personId} and l.table_name = 'people' and l.at > now() - interval '5 seconds') as recent
      from account.people p where p.id = ${personId}::uuid and p.is_active for update`;
    if (!now) return "no-person";
    if (now.same) return "saved";
    if (now.recent) return "wait";
    await tx`select set_config('account.actor', ${personId}, true)`;
    await tx`update account.people set avatar = ${tx.json(choice)} where id = ${personId}::uuid`;
    return "saved";
  })) as AvatarResult;
}
