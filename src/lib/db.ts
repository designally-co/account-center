import postgres from "postgres";
import { env } from "./env";

// One small pool for the server, as Account Center's own database user (account_app).
let sql: postgres.Sql | undefined;

// The connection to Project Friday is always encrypted; only a database on this machine (tests) may skip it.
function sslFor(url: string): "require" | false {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" ? false : "require";
}

export function db(): postgres.Sql {
  sql ??= postgres(env.databaseUrl, { max: 5, prepare: false, ssl: sslFor(env.databaseUrl) });
  return sql;
}
