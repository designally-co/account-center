// The app's access code against the real schema `account`, on a throwaway database (test/app/setup.ts).
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canUser, meByUser, ACTIONS } from "../../src/lib/access";
import { ANN, BEN, createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: postgres.Sql;

beforeAll(async () => {
  db = await createTestDb("account_center_access_test");
  await db.setup`select account.sync_from_hr()`;
  await db.setup`insert into account.grants (person_id, app_key, role_key)
                 select id, 'account_center', 'viewer' from account.people where auth_user_id in (${ANN}::uuid, ${BEN}::uuid)`;
  app = db.app;
});

afterAll(async () => { await db?.close(); });

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
