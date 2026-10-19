// The People page's data code against the real schema `account`, as Account Center's own user.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addPerson, addWorkEmail, listPeople, normalizeEmail, removePerson, removeWorkEmail } from "../../src/lib/people";
import { createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: postgres.Sql;
let annId: string;
let benId: string;
let deeId: string; // the admin who makes the changes

beforeAll(async () => {
  db = await createTestDb("account_center_people_test");
  await db.setup`select account.import_from_hr()`;
  deeId = await db.addAdmin();
  app = db.app;
});

afterAll(async () => { await db?.close(); });

describe("People", () => {
  it("cannot import from HR: that is done once, by a person", async () => {
    await expect(app`select account.import_from_hr()`).rejects.toThrow(/permission denied/);
  });

  it("lists people with their status and no HR details", async () => {
    const people = await listPeople(app);
    expect(people.map((p) => p.display_name)).toEqual(["Ann", "Ben Example", "Dee", "Cat"]);
    const ann = people.find((p) => p.display_name === "Ann")!;
    const ben = people.find((p) => p.display_name === "Ben Example")!;
    const cat = people.find((p) => p.display_name === "Cat")!;
    expect(ann).toMatchObject({ email: "ann@example.com", source: "hr", is_active: true, login: "ok", work_emails: [], app_count: 0 });
    expect(ben.login).toBe("blocked");
    expect(cat.is_active).toBe(false);
    expect(Object.keys(ann).sort()).toEqual(["app_count", "avatar", "display_name", "email", "id", "is_active", "kind", "login", "source", "work_emails"]);
    expect(ann.kind).toBe("Employee");
    annId = ann.id;
    benId = ben.id;
  });

  it("adds a work email, cleaned up, and logs who added it", async () => {
    expect(await addWorkEmail(app, deeId, annId, "  Ann@Work.Example ")).toBe("added");
    const ann = (await listPeople(app)).find((p) => p.id === annId)!;
    expect(ann.work_emails).toEqual(["ann@work.example"]);
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name = 'person_emails'`;
    expect(log.n).toBe(1);
  });

  it("refuses bad, taken and borrowed emails", async () => {
    expect(await addWorkEmail(app, deeId, annId, "not an email")).toBe("invalid");
    expect(await addWorkEmail(app, deeId, benId, "ann@work.example")).toBe("taken");
    expect(await addWorkEmail(app, deeId, benId, "ann@example.com")).toBe("main-email-of-another");
    expect(await addWorkEmail(app, deeId, "00000000-0000-0000-0000-000000000000", "x@work.example")).toBe("no-person");
    expect(await addWorkEmail(app, deeId, "not-a-uuid", "y@work.example")).toBe("no-person");
  });

  it("removes a work email only from the right person", async () => {
    expect(await removeWorkEmail(app, deeId, benId, "ann@work.example")).toBe("not-found");
    expect(await removeWorkEmail(app, deeId, annId, "ann@work.example")).toBe("removed");
    expect(await removeWorkEmail(app, benId, annId, "ann@work.example")).toBe("not-allowed");
    expect((await listPeople(app)).find((p) => p.id === annId)!.work_emails).toEqual([]);
  });

  it("checks email shape", () => {
    expect(normalizeEmail(" A@B.co ")).toBe("a@b.co");
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a b@c.co")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe("Removing someone who left", () => {
  it("takes away every role at once, marks them inactive, and logs who did it", async () => {
    await db.setup`insert into account.actions (app_key, key) values ('studio', 'studio.article.publish')`;
    await db.setup`insert into account.roles (app_key, key, name) values ('studio', 'publisher', 'Publisher')`;
    await db.setup`insert into account.role_actions values ('studio', 'publisher', 'studio.article.publish')`;
    await db.setup`insert into account.grants (person_id, app_key, role_key) values (${annId}::uuid, 'studio', 'publisher')`;
    await db.setup`insert into account.actions (app_key, key) values ('hub', 'hub.article.edit')`;
    await db.setup`insert into account.person_actions (person_id, action_key, allowed) values (${annId}::uuid, 'hub.article.edit', true)`;
    const ann = "00000000-0000-0000-0000-00000000000a";
    const [before] = await app<{ ok: boolean }[]>`select account.can_user(${ann}::uuid, 'studio.article.publish') as ok`;
    expect(before.ok).toBe(true);

    expect(await removePerson(app, deeId, annId)).toBe("removed");

    const [after] = await app<{ ok: boolean }[]>`select account.can_user(${ann}::uuid, 'studio.article.publish') as ok`;
    expect(after.ok).toBe(false);
    const row = (await listPeople(app)).find((p) => p.id === annId)!;
    expect(row).toMatchObject({ is_active: false, app_count: 0 });
    const [left] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.person_actions where person_id = ${annId}::uuid`;
    expect(left.n).toBe(0); // single changes go too, so nothing comes back if the person ever returns
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name in ('people', 'grants') and row_before->>'person_id' is not distinct from ${annId} or (actor = ${deeId} and table_name = 'people' and row_after->>'id' = ${annId})`;
    expect(log.n).toBeGreaterThanOrEqual(2);
  });

  it("refuses yourself, unknown people, and people already removed", async () => {
    expect(await removePerson(app, benId, benId)).toBe("yourself");
    expect(await removePerson(app, deeId, deeId.toUpperCase())).toBe("yourself");
    expect(await removePerson(app, benId, deeId)).toBe("not-allowed");
    expect(await removePerson(app, deeId, "00000000-0000-0000-0000-000000000000")).toBe("not-found");
    expect(await removePerson(app, deeId, "not-a-uuid")).toBe("not-found");
    expect(await removePerson(app, deeId, annId)).toBe("not-found");
  });
});

describe("Add person", () => {
  it("adds a new company person without a login yet, logged with the admin", async () => {
    const added = await addPerson(app, deeId, { name: "  Fay   New ", email: " Fay@Example.com ", kind: "outsource" });
    expect(added.result).toBe("added");
    const fay = (await listPeople(app)).find((p) => p.email === "fay@example.com")!;
    expect(fay).toMatchObject({ display_name: "Fay New", source: "account_center", kind: "Outsource", login: "missing", is_active: true });
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name = 'people' and event = 'insert' and row_after->>'email' = 'fay@example.com'`;
    expect(log.n).toBe(1);
  });

  it("points to the person who already has the email, and refuses bad input and non-admins", async () => {
    const taken = await addPerson(app, deeId, { name: "Fay Again", email: "fay@example.com", kind: "employee" });
    expect(taken.result).toBe("taken");
    expect(await addPerson(app, deeId, { name: " ", email: "x@example.com", kind: "employee" })).toEqual({ result: "invalid-name" });
    expect(await addPerson(app, deeId, { name: "X", email: "not-an-email", kind: "employee" })).toEqual({ result: "invalid-email" });
    expect(await addPerson(app, deeId, { name: "X", email: "x@example.com", kind: "boss" })).toEqual({ result: "invalid-kind" });
    expect(await addPerson(app, benId, { name: "X", email: "x@example.com", kind: "employee" })).toEqual({ result: "not-allowed" });
    await db.setup`insert into account.person_emails (email, person_id) values ('work@example.com', ${deeId}::uuid)`;
    expect(await addPerson(app, deeId, { name: "X", email: "work@example.com", kind: "employee" })).toEqual({ result: "work-email-of-another" });
    expect((await listPeople(app)).some((p) => p.email === "x@example.com")).toBe(false);
    // Someone removed earlier is pointed out as removed, not as taken.
    const [cat] = await db.setup<{ id: string }[]>`select id::text from account.people where email = 'cat@example.com'`;
    expect(await addPerson(app, deeId, { name: "Cat", email: "cat@example.com", kind: "employee" })).toEqual({ result: "removed", id: cat.id });
  });
});
