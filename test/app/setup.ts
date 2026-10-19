// A throwaway database with the real schema `account`, for the app tests.
// Needs TEST_ADMIN_URL: a superuser on a test server (scripts/local-postgres.sh prints one). Never Friday.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

export const ANN = "00000000-0000-0000-0000-00000000000a"; // active, login ok
export const BEN = "00000000-0000-0000-0000-00000000000b"; // active, login blocked

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

export async function createTestDb(name: string) {
  const adminUrl = process.env.TEST_ADMIN_URL;
  if (!adminUrl) throw new Error("Set TEST_ADMIN_URL to a test server's superuser connection string");
  if (adminUrl.includes("supabase")) throw new Error("Refusing: tests need a throwaway server, not Supabase");
  const url = adminUrl.replace(/\/[^/]*$/, `/${name}`);
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  const dropAll = async () => {
    await admin.unsafe(`drop database if exists ${name}`);
    for (const r of ["account_app", "hub_app", "studio_app"]) await admin.unsafe(`drop role if exists ${r}`);
  };
  await dropAll();
  await admin.unsafe(`create database ${name}`);
  const setup = postgres(url, { max: 1, onnotice: () => {} });
  await setup.unsafe(read("test/stand-ins.sql"));
  await setup.unsafe(read("test/seed.sql"));
  await setup.unsafe(read("supabase/migrations/20261014100000_account_schema.sql"));
  // The app connects as Account Center's own user, like in Friday.
  const app = postgres(url, { max: 1, connection: { role: "account_app" }, onnotice: () => {} });
  return {
    setup,
    app,
    async close() { await app.end(); await setup.end(); await dropAll(); await admin.end(); },
  };
}
