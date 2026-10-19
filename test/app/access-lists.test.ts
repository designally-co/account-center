// The access-list code against the real schema `account`, as Account Center's own user (account_app).
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPersonAccess, listKinds, saveAppAccess, setKind } from "../../src/lib/access-lists";
import { listPeople } from "../../src/lib/people";
import { ANN, DEE, createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: postgres.Sql;
let annId: string;
let benId: string;
let catId: string;
let deeId: string; // the admin who makes the changes

async function can(authUserId: string, action: string): Promise<boolean> {
  const [row] = await app<{ ok: boolean }[]>`select account.can_user(${authUserId}::uuid, ${action}) as ok`;
  return row.ok;
}

// The two ways an admin uses an app's form: choose a role (the ticks follow it), or change only the ticks.
function setAppRole(sql: postgres.Sql, actor: string, person: string, appKey: string, role: string | null, version: string) {
  return saveAppAccess(sql, actor, person, appKey, role, null, version);
}
async function saveAppActions(sql: postgres.Sql, actor: string, person: string, appKey: string, ticked: string[], version: string) {
  const role = (await getPersonAccess(app, person))?.apps.find((a) => a.key === appKey)?.roleKeys[0] ?? null;
  return saveAppAccess(sql, actor, person, appKey, role, ticked, version);
}

// The version an admin's page would carry for one app of one person.
async function v(personId: string, appKey: string): Promise<string> {
  return (await getPersonAccess(app, personId))!.apps.find((a) => a.key === appKey)!.version;
}

beforeAll(async () => {
  db = await createTestDb("account_center_access_lists_test");
  await db.setup`select account.import_from_hr()`;
  await db.setup`insert into account.actions (app_key, key, description) values
    ('studio', 'studio.article.generate', 'Generate an article'),
    ('studio', 'studio.article.publish', 'Publish an article'),
    ('hr', 'hr.leave.view', 'See leave')`;
  await db.setup`insert into account.roles (app_key, key, name) values ('studio', 'writer', 'Writer'), ('studio', 'publisher', 'Publisher'), ('hr', 'staff', 'Staff')`;
  await db.setup`insert into account.role_actions values
    ('studio', 'writer', 'studio.article.generate'),
    ('studio', 'publisher', 'studio.article.generate'), ('studio', 'publisher', 'studio.article.publish'),
    ('hr', 'staff', 'hr.leave.view')`;
  deeId = await db.addAdmin();
  const people = await db.setup<{ id: string; email: string }[]>`select id, email from account.people`;
  annId = people.find((p) => p.email === "ann@example.com")!.id;
  benId = people.find((p) => p.email === "ben@example.com")!.id;
  catId = people.find((p) => p.email === "cat@example.com")!.id;
  app = db.app;
});

afterAll(async () => { await db?.close(); });

describe("Access lists", () => {
  it("lists the kinds, employee first", async () => {
    expect((await listKinds(app)).map((k) => k.key)).toEqual(["employee", "outsource"]);
  });

  it("shows every app with its actions, and nothing on by default", async () => {
    const ann = (await getPersonAccess(app, annId))!;
    expect(ann.kind).toBe("employee");
    const studio = ann.apps.find((a) => a.key === "studio")!;
    expect(studio.roles.map((r) => r.key)).toEqual(["publisher", "writer"]);
    expect(studio.actions.map((a) => [a.key, a.on])).toEqual([["studio.article.generate", false], ["studio.article.publish", false]]);
    expect(ann.apps.find((a) => a.key === "hr")!.isPrototype).toBe(true);
    expect(await getPersonAccess(app, "not-a-uuid")).toBeNull();
  });

  it("gives a ready role, and the check agrees", async () => {
    expect(await setAppRole(app, deeId, annId, "studio", "writer", await v(annId, "studio"))).toBe("saved");
    expect(await can(ANN, "studio.article.generate")).toBe(true);
    expect(await can(ANN, "studio.article.publish")).toBe(false);
  });

  it("stores only the differences from the role: generate but not publish, then publish too", async () => {
    const ticked = ["studio.article.generate", "studio.article.publish", "hub.not.this.app"];
    expect(await saveAppActions(app, deeId, annId, "studio", ticked, await v(annId, "studio"))).toBe("saved");
    let studio = (await getPersonAccess(app, annId))!.apps.find((a) => a.key === "studio")!;
    expect(studio.actions.find((a) => a.key === "studio.article.publish")).toMatchObject({ inRole: false, exception: "added", on: true });
    expect(await can(ANN, "studio.article.publish")).toBe(true);
    const [n] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.person_actions where person_id = ${annId}::uuid`;
    expect(n.n).toBe(1);

    expect(await saveAppActions(app, deeId, annId, "studio", [], await v(annId, "studio"))).toBe("saved");
    studio = (await getPersonAccess(app, annId))!.apps.find((a) => a.key === "studio")!;
    expect(studio.actions.find((a) => a.key === "studio.article.generate")).toMatchObject({ inRole: true, exception: "taken-away", on: false });
    expect(await can(ANN, "studio.article.generate")).toBe(false);
  });

  it("choosing a role again starts fresh: the single changes in that app go", async () => {
    expect(await setAppRole(app, deeId, annId, "studio", "publisher", await v(annId, "studio"))).toBe("saved");
    const studio = (await getPersonAccess(app, annId))!.apps.find((a) => a.key === "studio")!;
    expect(studio.roleKeys).toEqual(["publisher"]);
    expect(studio.actions.every((a) => a.on && a.exception === null)).toBe(true);
    expect(await can(ANN, "studio.article.publish")).toBe(true);
  });

  it("saves the role and the ticks together: a writer who may also publish, in one save", async () => {
    expect(await setAppRole(app, deeId, benId, "studio", null, await v(benId, "studio"))).toBe("saved");
    const ticked = ["studio.article.generate", "studio.article.publish"];
    expect(await saveAppAccess(app, deeId, benId, "studio", "writer", ticked, await v(benId, "studio"))).toBe("saved");
    const studio = (await getPersonAccess(app, benId))!.apps.find((a) => a.key === "studio")!;
    expect(studio.roleKeys).toEqual(["writer"]);
    expect(studio.actions.map((a) => [a.key, a.exception])).toEqual([["studio.article.generate", null], ["studio.article.publish", "added"]]);
    // Ticks made for another role (the page's script did not run) are not used: only the role is saved.
    expect(await saveAppAccess(app, deeId, benId, "studio", "publisher", null, await v(benId, "studio"))).toBe("saved");
    expect((await getPersonAccess(app, benId))!.apps.find((a) => a.key === "studio")!.actions.every((a) => a.on && a.exception === null)).toBe(true);
    expect(await setAppRole(app, deeId, benId, "studio", null, await v(benId, "studio"))).toBe("saved");
  });

  it("refuses a save from a page opened before someone else changed the same access", async () => {
    const before = await v(annId, "studio");
    expect(await setAppRole(app, deeId, annId, "studio", "writer", before)).toBe("saved");
    // The older page still shows Publisher; saving it unchanged must not take publish away or add it back.
    expect(await saveAppActions(app, deeId, annId, "studio", ["studio.article.generate", "studio.article.publish"], before)).toBe("changed");
    expect(await setAppRole(app, deeId, annId, "studio", "publisher", before)).toBe("changed");
    expect((await getPersonAccess(app, annId))!.apps.find((a) => a.key === "studio")!.roleKeys).toEqual(["writer"]);
    // A new action for the app also makes older pages out of date.
    const now = await v(annId, "studio");
    await db.setup`insert into account.actions (app_key, key, description) values ('studio', 'studio.article.delete', 'Delete an article')`;
    expect(await saveAppActions(app, deeId, annId, "studio", ["studio.article.generate"], now)).toBe("changed");
    expect(await setAppRole(app, deeId, annId, "studio", "publisher", await v(annId, "studio"))).toBe("saved");
  });

  it("logs every change with the admin who made it", async () => {
    const [n] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name in ('grants', 'person_actions')`;
    expect(n.n).toBeGreaterThanOrEqual(5);
  });

  it("keeps an outsource account out of HR, and refuses a kind change while HR access exists", async () => {
    expect(await setAppRole(app, deeId, annId, "hr", "staff", await v(annId, "hr"))).toBe("saved");
    expect(await setKind(app, deeId, annId, "outsource")).toEqual({ result: "kind-blocked", app: "hr" });
    expect(await setAppRole(app, deeId, annId, "hr", null, await v(annId, "hr"))).toBe("saved");
    expect((await setKind(app, deeId, annId, "outsource")).result).toBe("saved");
    expect(await setAppRole(app, deeId, annId, "hr", "staff", await v(annId, "hr"))).toBe("kept-out");
    expect(await saveAppActions(app, deeId, annId, "hr", ["hr.leave.view"], await v(annId, "hr"))).toBe("kept-out");
    const ann = (await getPersonAccess(app, annId))!;
    expect(ann.apps.find((a) => a.key === "hr")!.keptOut).toBe(true);
    expect(await can(ANN, "studio.article.publish")).toBe(true);
    expect((await setKind(app, deeId, annId, "no-such-kind")).result).toBe("unknown-kind");
    expect((await setKind(app, deeId, annId, "employee")).result).toBe("saved");
  });

  it("removes access left over from before a kind rule, and the counts follow the real check", async () => {
    expect(await setAppRole(app, deeId, annId, "hr", "staff", await v(annId, "hr"))).toBe("saved");
    await db.setup`insert into account.kind_blocked_apps (kind, app_key) values ('employee', 'hr')`;
    let hr = (await getPersonAccess(app, annId))!.apps.find((a) => a.key === "hr")!;
    expect(hr).toMatchObject({ keptOut: true, roleKeys: ["staff"] });
    expect(await can(ANN, "hr.leave.view")).toBe(false);
    const [me] = await app<{ me: { roles: { app: string }[] } }[]>`select account.me_by_user(${ANN}::uuid) as me`;
    expect(me.me.roles.map((r) => r.app)).toEqual(["studio"]);
    expect((await listPeople(app)).find((p) => p.id === annId)!.app_count).toBe(1);

    expect(await setAppRole(app, deeId, annId, "hr", null, hr.version)).toBe("saved");
    hr = (await getPersonAccess(app, annId))!.apps.find((a) => a.key === "hr")!;
    expect(hr.roleKeys).toEqual([]);
    await db.setup`delete from account.kind_blocked_apps where kind = 'employee' and app_key = 'hr'`;
    expect(await can(ANN, "hr.leave.view")).toBe(false);
  });

  it("refuses unknown apps and roles, removed people, and changes to your own Account Center access", async () => {
    expect(await setAppRole(app, deeId, annId, "nope", null, "x")).toBe("unknown-app");
    expect(await setAppRole(app, deeId, annId, "studio", "nope", await v(annId, "studio"))).toBe("unknown-role");
    expect(await setAppRole(app, deeId, catId, "studio", "writer", await v(catId, "studio"))).toBe("inactive");
    expect(await setAppRole(app, deeId, "00000000-0000-0000-0000-000000000000", "studio", "writer", "x")).toBe("not-found");
    const own = await v(deeId, "account_center");
    expect(await setAppRole(app, deeId, deeId, "account_center", null, own)).toBe("yourself");
    expect(await setAppRole(app, deeId, deeId.toUpperCase(), "account_center", null, own)).toBe("yourself");
    expect(await saveAppActions(app, deeId, deeId.toUpperCase(), "account_center", [], own)).toBe("yourself");
    expect(await can(DEE, "account_center.manage")).toBe(true);
    expect(await setAppRole(app, deeId, deeId, "studio", "writer", await v(deeId, "studio"))).toBe("saved");
  });

  it("refuses changes from someone who cannot manage Account Center", async () => {
    expect(await setAppRole(app, annId, benId, "studio", "writer", await v(benId, "studio"))).toBe("not-allowed");
    expect((await setKind(app, benId, annId, "outsource")).result).toBe("not-allowed");
    expect(await saveAppActions(app, "not-a-uuid", annId, "studio", [], await v(annId, "studio"))).toBe("not-allowed");
    // Manage without view (possible with single changes) is not enough to make changes.
    expect(await saveAppAccess(app, deeId, annId, "account_center", "admin", ["account_center.manage"], await v(annId, "account_center"))).toBe("saved");
    expect(await can(ANN, "account_center.manage")).toBe(true);
    expect(await setAppRole(app, annId, benId, "studio", "writer", await v(benId, "studio"))).toBe("not-allowed");
    expect(await setAppRole(app, deeId, annId, "account_center", null, await v(annId, "account_center"))).toBe("saved");
  });

  it("a kind change and a new HR role at the same moment cannot both win", async () => {
    // Without a lock, the role's check reads the old kind and both commit (an outsource account with an HR role).
    const kindChange = db.setup.begin(async (tx) => {
      await tx`update account.people set kind = 'outsource' where id = ${benId}::uuid`;
      await new Promise((r) => setTimeout(r, 500));
    });
    await new Promise((r) => setTimeout(r, 100));
    const grant = db.otherApp()`insert into account.grants (person_id, app_key, role_key) values (${benId}::uuid, 'hr', 'staff')`
      .execute().then(() => null, (error: { code?: string }) => error);
    await kindChange;
    expect((await grant)?.code).toBe("AC001");
    await db.setup`update account.people set kind = 'employee' where id = ${benId}::uuid`;
  });

  it("two admins taking each other's Account Center rights at the same moment leaves one admin", async () => {
    expect(await setAppRole(app, deeId, annId, "account_center", "admin", await v(annId, "account_center"))).toBe("saved");
    const [vAnn, vDee] = [await v(annId, "account_center"), await v(deeId, "account_center")];
    const results = await Promise.all([
      setAppRole(db.otherApp(), annId, deeId, "account_center", null, vDee),
      setAppRole(db.otherApp(), deeId, annId, "account_center", null, vAnn),
    ]);
    expect(results.sort()).toEqual(["not-allowed", "saved"]);
    expect([await can(ANN, "account_center.manage"), await can(DEE, "account_center.manage")].filter(Boolean)).toHaveLength(1);
  });
});
