// Avatars: the strict check of the choices, the stable starting face, and saving your own avatar only.
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BACKGROUNDS, PARTS, avatarDataUri, defaultAvatar, parseAvatar } from "../../src/lib/avatar";
import { saveMyAvatar } from "../../src/lib/self";
import { ANN, BEN, createTestDb } from "./setup";

describe("Avatar choices", () => {
  it("gives the same starting face to the same person, and it passes the check", () => {
    const a = defaultAvatar("person-1");
    expect(defaultAvatar("person-1")).toEqual(a);
    expect(parseAvatar(a)).toEqual(a);
    expect(defaultAvatar("person-2")).not.toEqual(a);
  });

  it("knows every part of the drawing style", () => {
    expect(PARTS.map((p) => p.key)).toEqual(["hair", "eyes", "brows", "lips", "nose", "glasses", "beard", "body", "gesture", "bodyIcon"]);
    expect(PARTS.every((p) => p.options.length > 0)).toBe(true);
  });

  it("refuses anything that is not a known part with a known value", () => {
    const ok = defaultAvatar("x");
    expect(parseAvatar({ ...ok, script: "<svg onload=alert(1)>" })).toBeNull();
    expect(parseAvatar({ ...ok, hair: "variant99" })).toBeNull();
    expect(parseAvatar({ ...ok, hair: null })).toBeNull();          // hair is not optional
    expect(parseAvatar({ ...ok, glasses: null })).not.toBeNull();    // glasses are
    expect(parseAvatar({ ...ok, background: "ff0000" })).toBeNull(); // only the palette
    expect(parseAvatar({ ...ok, background: BACKGROUNDS[0] })).not.toBeNull();
    expect(parseAvatar([ok])).toBeNull();
    expect(parseAvatar("hair")).toBeNull();
    expect(parseAvatar(null)).toBeNull();
  });

  it("draws an image address, never markup to put in the page", () => {
    expect(avatarDataUri(defaultAvatar("x"))).toMatch(/^data:image\/svg\+xml;/);
  });
});

describe("Saving your own avatar", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let app: postgres.Sql;

  beforeAll(async () => {
    db = await createTestDb("account_center_avatar_test");
    await db.setup`select account.import_from_hr()`;
    app = db.app;
  });
  afterAll(async () => { await db?.close(); });

  it("saves the signed-in person's avatar, logged as their own change", async () => {
    const choice = { ...defaultAvatar("ann"), glasses: PARTS.find((p) => p.key === "glasses")!.options[0] };
    expect(await saveMyAvatar(app, ANN, choice)).toBe("saved");
    const [row] = await app<{ me: { avatar: unknown; person_id: string } }[]>`select account.me_by_user(${ANN}::uuid) as me`;
    expect(row.me.avatar).toEqual(choice);
    const [log] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.log where actor = ${row.me.person_id} and table_name = 'people'`;
    expect(log.n).toBe(1);
  });

  it("refuses a bad avatar, a blocked login, a removed person and an unknown account", async () => {
    expect(await saveMyAvatar(app, ANN, { hair: "variant01" })).toBe("invalid");
    expect(await saveMyAvatar(app, BEN, defaultAvatar("ben"))).toBe("no-person");
    expect(await saveMyAvatar(app, "00000000-0000-0000-0000-00000000000c", defaultAvatar("cat"))).toBe("no-person");
    expect(await saveMyAvatar(app, "00000000-0000-0000-0000-000000000099", defaultAvatar("x"))).toBe("no-person");
    const [n] = await db.setup<{ n: number }[]>`select count(*)::int as n from account.people where avatar is not null`;
    expect(n.n).toBe(1);
  });
});
