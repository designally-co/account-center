// The People page's data code against the real schema `account`, as Account Center's own user.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addWorkEmail, copyFromHr, listPeople, normalizeEmail, removeWorkEmail } from "../../src/lib/people";
import { createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: postgres.Sql;
let annId: string;
let benId: string;

beforeAll(async () => {
  db = await createTestDb("account_center_people_test");
  app = db.app;
});

afterAll(async () => { await db?.close(); });

describe("People", () => {
  it("copies from HR when an admin presses the button, and logs who did it", async () => {
    const result = await copyFromHr(app, "admin-1");
    expect(result).toEqual({ added: 3, updated: 0, linked: 0, marked_inactive: 0 });
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = 'sync by admin-1'`;
    expect(log.n).toBe(3);
  });

  it("lists people with their status and no HR details", async () => {
    const people = await listPeople(app);
    expect(people.map((p) => p.display_name)).toEqual(["Ann", "Ben Example", "Cat"]);
    const ann = people.find((p) => p.display_name === "Ann")!;
    const ben = people.find((p) => p.display_name === "Ben Example")!;
    const cat = people.find((p) => p.display_name === "Cat")!;
    expect(ann).toMatchObject({ email: "ann@example.com", source: "hr", is_active: true, login: "ok", work_emails: [], role_count: 0 });
    expect(ben.login).toBe("blocked");
    expect(cat.is_active).toBe(false);
    expect(Object.keys(ann).sort()).toEqual(["display_name", "email", "id", "is_active", "login", "role_count", "source", "work_emails"]);
    annId = ann.id;
    benId = ben.id;
  });

  it("adds a work email, cleaned up, and logs who added it", async () => {
    expect(await addWorkEmail(app, "admin-1", annId, "  Ann@Work.Example ")).toBe("added");
    const ann = (await listPeople(app)).find((p) => p.id === annId)!;
    expect(ann.work_emails).toEqual(["ann@work.example"]);
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = 'admin-1' and table_name = 'person_emails'`;
    expect(log.n).toBe(1);
  });

  it("refuses bad, taken and borrowed emails", async () => {
    expect(await addWorkEmail(app, "admin-1", annId, "not an email")).toBe("invalid");
    expect(await addWorkEmail(app, "admin-1", benId, "ann@work.example")).toBe("taken");
    expect(await addWorkEmail(app, "admin-1", benId, "ann@example.com")).toBe("main-email-of-another");
    expect(await addWorkEmail(app, "admin-1", "00000000-0000-0000-0000-000000000000", "x@work.example")).toBe("no-person");
    expect(await addWorkEmail(app, "admin-1", "not-a-uuid", "y@work.example")).toBe("no-person");
  });

  it("removes a work email only from the right person", async () => {
    expect(await removeWorkEmail(app, "admin-1", benId, "ann@work.example")).toBe(false);
    expect(await removeWorkEmail(app, "admin-1", annId, "ann@work.example")).toBe(true);
    expect((await listPeople(app)).find((p) => p.id === annId)!.work_emails).toEqual([]);
  });

  it("checks email shape", () => {
    expect(normalizeEmail(" A@B.co ")).toBe("a@b.co");
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a b@c.co")).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});
