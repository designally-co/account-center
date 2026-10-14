import type postgres from "postgres";

// Runs changes in one transaction and names the admin who made them, so the change log shows who did it.
export async function withActor<T>(sql: postgres.Sql, personId: string, work: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`select set_config('account.actor', ${personId}, true)`;
    return work(tx);
  })) as T;
}
