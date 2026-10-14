import postgres from "postgres";
import { env } from "./env";

// One small pool for the server, as Account Center's own database user (account_app).
let sql: postgres.Sql | undefined;

export function db(): postgres.Sql {
  sql ??= postgres(env.databaseUrl, { max: 5, prepare: false });
  return sql;
}
