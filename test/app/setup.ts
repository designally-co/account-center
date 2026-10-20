// A throwaway database with the real schema `account`, for the app tests.
// Needs TEST_ADMIN_URL: a superuser on a test server (scripts/local-postgres.sh prints one). Never Friday.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export const ANN = "00000000-0000-0000-0000-00000000000a"; // active, login ok
export const BEN = "00000000-0000-0000-0000-00000000000b"; // active, login blocked
export const DEE = "00000000-0000-0000-0000-00000000000d"; // not in HR; added in Account Center as the admin

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

export async function createTestDb(name: string) {
  const adminUrl = process.env.TEST_ADMIN_URL;
  if (!adminUrl) throw new Error("Set TEST_ADMIN_URL to a test server's superuser connection string");
  if (adminUrl.includes("supabase")) throw new Error("Refusing: tests need a throwaway server, not Supabase");
  const url = adminUrl.replace(/\/[^/]*$/, `/${name}`);
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  const dropAll = async () => {
    await admin.unsafe(`drop database if exists ${name}`);
    for (const r of ["account_app", "hub_app", "studio_app", "portal_check"]) await admin.unsafe(`drop role if exists ${r}`);
  };
  await dropAll();
  await admin.unsafe(`create database ${name}`);
  const setup = postgres(url, { max: 1, onnotice: () => {} });
  await setup.unsafe(read("test/stand-ins.sql"));
  await setup.unsafe(read("test/seed.sql"));
  const migrations = readdirSync(join(__dirname, "..", "..", "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migrations) await setup.unsafe(read(`supabase/migrations/${m}`));
  // The app connects as Account Center's own user, like in Friday.
  const appClient = () => postgres(url, { max: 1, connection: { role: "account_app" }, onnotice: () => {} });
  const app = appClient();
  const extra: postgres.Sql[] = [];
  return {
    setup,
    app,
    // Another connection as Account Center's user, for two changes at the same moment.
    otherApp() { const c = appClient(); extra.push(c); return c; },
    // A made-up admin who is not in HR (Dee), so the tests act as a real admin. Returns their person id.
    async addAdmin() {
      await setup`insert into account.people (auth_user_id, source, display_name, email) values (${DEE}::uuid, 'account_center', 'Dee', 'dee@example.com')`;
      const [row] = await setup<{ id: string }[]>`select account.bootstrap_first_admin('dee@example.com')::text as id`;
      return row.id;
    },
    async close() { for (const c of extra) await c.end(); await app.end(); await setup.end(); await dropAll(); await admin.end(); },
  };
}
