// The Shared subscriptions screens' data code against the real schema `account`, as Account Center's own user.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listPeople } from "../../src/lib/people";
import {
  addSubscriptionMember, candidatesFor, createSubscription, getSubscription, listSubscriptions, removeSubscriptionMember,
  setSubscriptionActive, subscriptionsOf, updateSubscription,
} from "../../src/lib/subscriptions";
import { createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let app: postgres.Sql;
let deeId: string; // the admin who makes the changes
let annId: string;
let catId: string; // left the company
let toolId: string;

const input = (over: Record<string, unknown> = {}) =>
  ({ name: "Claude", shared_email: " Team-Login@Example.com ", plan: "Team, 5 seats", url: "claude.ai", renews_on: "2026-11-30", ...over });

beforeAll(async () => {
  db = await createTestDb("account_center_subscriptions_test");
  await db.setup`select account.import_from_hr()`;
  deeId = await db.addAdmin();
  app = db.app;
  const people = await listPeople(app);
  annId = people.find((p) => p.display_name === "Ann")!.id;
  catId = people.find((p) => p.display_name === "Cat")!.id;
});

afterAll(async () => { await db?.close(); });

describe("Shared subscriptions", () => {
  it("adds a tool with its shared email cleaned up, and the sign-in address made safe", async () => {
    const made = await createSubscription(app, deeId, input());
    expect(made.result).toBe("added");
    toolId = (made as { id: string }).id;
    const sub = await getSubscription(app, toolId);
    expect(sub).toMatchObject({ name: "Claude", shared_email: "team-login@example.com", plan: "Team, 5 seats", url: "https://claude.ai",
                                renews_on: "2026-11-30", is_active: true, members: [] });
  });

  it("refuses bad details and a second tool with the same name", async () => {
    expect((await createSubscription(app, deeId, input({ name: "claude" }))).result).toBe("taken");
    expect((await createSubscription(app, deeId, input({ name: " " }))).result).toBe("invalid-name");
    expect((await createSubscription(app, deeId, input({ name: "X", shared_email: "not an email" }))).result).toBe("invalid-email");
    expect((await createSubscription(app, deeId, input({ name: "X", url: "http://insecure.example" }))).result).toBe("invalid-url");
    expect((await createSubscription(app, deeId, input({ name: "X", url: "https://user:secret@example.com" }))).result).toBe("invalid-url");
    expect((await createSubscription(app, deeId, input({ name: "X", renews_on: "2026-02-31x" }))).result).toBe("invalid-date");
    expect((await createSubscription(app, deeId, input({ name: "X", plan: "p".repeat(61) }))).result).toBe("invalid-plan");
  });

  it("adds people who may use it; only active people, once each", async () => {
    expect((await candidatesFor(app, toolId)).map((p) => p.display_name)).toContain("Ann");
    expect(await addSubscriptionMember(app, deeId, toolId, annId)).toBe("saved");
    expect(await addSubscriptionMember(app, deeId, toolId, annId)).toBe("already-member");
    expect(await addSubscriptionMember(app, deeId, toolId, catId)).toBe("inactive-person");
    expect((await candidatesFor(app, toolId)).map((p) => p.display_name)).not.toContain("Ann");
    expect((await subscriptionsOf(app, annId)).map((s) => s.name)).toEqual(["Claude"]);
  });

  it("keeps someone who left on the list, so the password can be changed", async () => {
    await db.setup`insert into account.subscription_members (subscription_id, person_id) values (${toolId}::uuid, ${catId}::uuid)`;
    const sub = (await listSubscriptions(app)).find((s) => s.id === toolId)!;
    expect(sub.members.map((m) => [m.display_name, m.is_active])).toEqual([["Ann", true], ["Cat", false]]);
    expect(await removeSubscriptionMember(app, deeId, toolId, catId)).toBe("saved");
    expect(await removeSubscriptionMember(app, deeId, toolId, catId)).toBe("not-member");
  });

  it("edits details, turns a tool off and on, and logs who did it", async () => {
    expect(await updateSubscription(app, deeId, toolId, input({ plan: "Max" }))).toBe("saved");
    expect(await setSubscriptionActive(app, deeId, toolId, false)).toBe("saved");
    expect((await getSubscription(app, toolId))!).toMatchObject({ plan: "Max", is_active: false });
    expect(await setSubscriptionActive(app, deeId, toolId, true)).toBe("saved");
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${deeId} and table_name in ('subscriptions', 'subscription_members')`;
    expect(log.n).toBeGreaterThanOrEqual(5);
  });

  it("refuses someone who is not an admin", async () => {
    expect((await createSubscription(app, annId, input({ name: "ChatGPT" }))).result).toBe("not-allowed");
    expect(await addSubscriptionMember(app, annId, toolId, annId)).toBe("not-allowed");
    expect(await removeSubscriptionMember(app, annId, toolId, annId)).toBe("not-allowed");
  });

  it("shows nothing, instead of failing, on a database without the tables yet", async () => {
    await db.setup`alter table account.subscription_members rename to subscription_members_hidden`;
    try {
      expect(await subscriptionsOf(app, annId)).toEqual([]);
    } finally {
      await db.setup`alter table account.subscription_members_hidden rename to subscription_members`;
    }
  });
});
