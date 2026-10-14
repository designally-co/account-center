// The app's access code against the real schema `account`, on a throwaway database.
// Needs TEST_ADMIN_URL: a superuser on a test server (scripts/local-postgres.sh prints one). Never Friday.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canUser, meByUser, ACTIONS } from "../../src/lib/access";

const ADMIN_URL = process.env.TEST_ADMIN_URL;
if (!ADMIN_URL) throw new Error("Set TEST_ADMIN_URL to a test server's superuser connection string");
if (ADMIN_URL.includes("supabase")) throw new Error("Refusing: tests need a throwaway server, not Supabase");

const DB = "account_center_app_test";
const TEST_URL = ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`);
const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
const ANN = "00000000-0000-0000-0000-00000000000a";
const BEN = "00000000-0000-0000-0000-00000000000b";

let admin: postgres.Sql;
let setup: postgres.Sql;
let app: postgres.Sql;

async function dropAll() {
  await admin.unsafe(`drop database if exists ${DB}`);
  for (const r of ["account_app", "hub_app", "studio_app"]) await admin.unsafe(`drop role if exists ${r}`);
}

beforeAll(async () => {
  admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await dropAll();
  await admin.unsafe(`create database ${DB}`);
  setup = postgres(TEST_URL, { max: 1, onnotice: () => {} });
  await setup.unsafe(read("test/stand-ins.sql"));
  await setup.unsafe(read("test/seed.sql"));
  await setup.unsafe(read("supabase/migrations/20261014100000_account_schema.sql"));
  await setup`select account.sync_from_hr()`;
  await setup`insert into account.grants (person_id, app_key, role_key)
              select id, 'account_center', 'viewer' from account.people where auth_user_id in (${ANN}::uuid, ${BEN}::uuid)`;
  // The app connects as Account Center's own user, like in Friday.
  app = postgres(TEST_URL, { max: 1, connection: { role: "account_app" }, onnotice: () => {} });
});

afterAll(async () => {
  await app?.end();
  await setup?.end();
  if (admin) { await dropAll(); await admin.end(); }
});

describe("access as Account Center's own database user", () => {
  it("runs as account_app", async () => {
    const [row] = await app<{ who: string }[]>`select current_user as who`;
    expect(row.who).toBe("account_app");
  });

  it("lets a viewer view, not manage", async () => {
    expect(await canUser(app, ANN, ACTIONS.view)).toBe(true);
    expect(await canUser(app, ANN, ACTIONS.manage)).toBe(false);
  });

  it("says no to a blocked login, even with a role", async () => {
    expect(await canUser(app, BEN, ACTIONS.view)).toBe(false);
    expect(await meByUser(app, BEN)).toBeNull();
  });

  it("says no to an unknown account", async () => {
    expect(await canUser(app, "00000000-0000-0000-0000-0000000000ff", ACTIONS.view)).toBe(false);
    expect(await meByUser(app, "00000000-0000-0000-0000-0000000000ff")).toBeNull();
  });

  it("returns the person's name and roles", async () => {
    const me = await meByUser(app, ANN);
    expect(me?.display_name).toBe("Ann");
    expect(me?.roles).toEqual([{ app: "account_center", role: "viewer" }]);
  });

  it("cannot read HR's table", async () => {
    await expect(app`select 1 from public.hr_employees limit 1`).rejects.toThrow(/permission denied/);
  });
});
