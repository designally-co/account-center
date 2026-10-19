import type postgres from "postgres";
import { isUuid } from "./ids";

// The admin's right to manage was taken away (or never existed) by the time the change ran.
export class NotAllowed extends Error {
  constructor() { super("not allowed to manage Account Center"); }
}

// Every change to people and access runs here, in one transaction:
// - one change at a time (a lock held until the end of the transaction), so no change acts on stale facts,
//   and two admins can never take each other's rights at the same moment;
// - the admin's own rights are checked again inside the transaction, after the lock: both "view" and
//   "manage" (single changes could leave someone with manage but no view, and they must not act unseen);
// - the admin is named, so the change log shows who did it.
export async function withActor<T>(sql: postgres.Sql, personId: string, work: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  if (!isUuid(personId)) throw new NotAllowed();
  return (await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('account.changes'))`;
    const [row] = await tx<{ ok: boolean }[]>`
      select coalesce((select account.can_user(p.auth_user_id, 'account_center.view')
                              and account.can_user(p.auth_user_id, 'account_center.manage')
                       from account.people p where p.id = ${personId}::uuid), false) as ok`;
    if (!row?.ok) throw new NotAllowed();
    await tx`select set_config('account.actor', ${personId}, true)`;
    return work(tx);
  })) as T;
}
