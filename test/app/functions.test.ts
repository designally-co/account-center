// The server functions' logic (supabase/functions/_shared/core.ts) against the real schema `account`.
// Friday's Auth is replaced by a small fake that keeps its accounts in the test database's auth.users,
// and email by a list, so every rule can be checked without a network.
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type Deps, type Mail, type MailResult, invite, recover } from "../../supabase/functions/_shared/core";
import { ANN, BEN, DEE, createTestDb } from "./setup";

let db: Awaited<ReturnType<typeof createTestDb>>;
let sql: postgres.Sql;
let authDb: postgres.Sql; // the fake Auth's own connection, like Friday's Auth server has
let deeId: string;
let mails: Mail[];
let mailMode: "send" | "off" | "fail";
let tokens = 0;

const AUTH = "http://auth.test/auth/v1";
const token = (authUserId: string) => `token-${authUserId}`;

// Just enough of Friday's Auth: who owns a token, and generate_link (invite and recovery).
async function fakeAuth(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  const headers = new Headers(init?.headers);
  if (url === `${AUTH}/user`) {
    const id = headers.get("authorization")?.match(/^Bearer token-(.+)$/)?.[1];
    if (!id) return json(401, {});
    const [u] = await authDb`select id::text from auth.users where id::text = ${id}`;
    return u ? json(200, { id: u.id }) : json(401, {});
  }
  if (url === `${AUTH}/admin/generate_link`) {
    if (headers.get("authorization") !== "Bearer service-key") return json(401, {});
    const { type, email } = JSON.parse(String(init?.body));
    const [u] = await authDb<{ id: string; email: string; email_confirmed_at: Date | null; invited_at: Date | null }[]>`
      select id::text, email, email_confirmed_at, invited_at from auth.users where lower(email) = lower(${email})`;
    const hashed_token = `hash-${++tokens}`;
    if (type === "invite") {
      if (u && (u.email_confirmed_at || !u.invited_at)) return json(422, { error_code: "email_exists" });
      if (u) {
        await authDb`update auth.users set invited_at = now() where id = ${u.id}::uuid`;
        return json(200, { id: u.id, email: u.email, hashed_token });
      }
      const [made] = await authDb<{ id: string }[]>`insert into auth.users (id, email, invited_at) values (gen_random_uuid(), ${email}, now()) returning id::text`;
      return json(200, { id: made.id, email, hashed_token });
    }
    if (type === "recovery") {
      if (!u) return json(404, { error_code: "user_not_found" });
      await authDb`update auth.users set recovery_sent_at = now() where id = ${u.id}::uuid`;
      return json(200, { id: u.id, email: u.email, hashed_token });
    }
  }
  return json(404, {});
}

function deps(): Deps {
  return {
    sql,
    authUrl: AUTH,
    serviceKey: "service-key",
    appUrl: "https://account.example",
    orgName: "Example Co",
    sendMail: async (mail: Mail): Promise<MailResult> => {
      if (mailMode === "off") return { ok: false, skipped: true };
      if (mailMode === "fail") return { ok: false, error: "down" };
      mails.push(mail);
      return { ok: true };
    },
  };
}

async function addPerson(email: string, name: string, authUserId: string | null = null): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into account.people (auth_user_id, source, display_name, email)
    values (${authUserId}, 'account_center', ${name}, ${email}) returning id::text`;
  return row.id;
}

const linkOf = (mail: Mail) => mail.text.match(/https:\/\/\S+/)![0];

beforeAll(async () => {
  db = await createTestDb("account_center_functions_test");
  sql = db.setup;
  authDb = postgres(process.env.TEST_ADMIN_URL!.replace(/\/[^/]*$/, "/account_center_functions_test"), { max: 1, onnotice: () => {} });
  await sql`select account.import_from_hr()`;
  deeId = await db.addAdmin();
  vi.stubGlobal("fetch", fakeAuth);
});

afterAll(async () => { vi.unstubAllGlobals(); await authDb?.end(); await db?.close(); });

beforeEach(() => { mails = []; mailMode = "send"; });

describe("account-invite", () => {
  it("refuses a missing, made-up or non-admin token", async () => {
    const eve = await addPerson("eve@example.com", "Eve");
    expect((await invite(deps(), null, eve)).status).toBe(401);
    expect((await invite(deps(), "token-00000000-0000-0000-0000-000000000099", eve)).status).toBe(401);
    expect(await invite(deps(), token(ANN), eve)).toEqual({ status: 403, body: { error: "not-allowed" } });
    expect((await invite(deps(), token(DEE), "not-an-id")).status).toBe(400);
    expect(mails).toHaveLength(0);
  });

  it("makes an invited account, links it and emails a one-time link to Account Center's accept page", async () => {
    const fay = await addPerson("fay@example.com", "Fay");
    expect(await invite(deps(), token(DEE), fay)).toEqual({ status: 200, body: { result: "sent" } });
    const [person] = await sql<{ auth_user_id: string; state: string }[]>`
      select auth_user_id::text, account.login_state(auth_user_id) as state from account.people where id = ${fay}::uuid`;
    expect(person.state).toBe("invited");
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("fay@example.com");
    expect(mails[0].subject).toBe("Your Example Co account");
    expect(linkOf(mails[0])).toMatch(/^https:\/\/account\.example\/accept\?type=invite&token_hash=hash-\d+$/);
    expect(mails[0].html).toContain("Hello Fay,");
    // The change log names the admin who sent it.
    const [log] = await sql<{ n: number }[]>`
      select count(*)::int as n from account.log
      where actor = ${deeId} and table_name = 'people' and event = 'update' and row_after->>'id' = ${fay}`;
    expect(log.n).toBe(1);
  });

  it("sends again only after a minute, with a new link", async () => {
    const fay = (await sql<{ id: string }[]>`select id::text from account.people where email = 'fay@example.com'`)[0].id;
    expect(await invite(deps(), token(DEE), fay)).toEqual({ status: 429, body: { error: "too-soon" } });
    await sql`update auth.users set invited_at = now() - interval '2 minutes' where email = 'fay@example.com'`;
    expect((await invite(deps(), token(DEE), fay)).body).toEqual({ result: "sent" });
    expect(mails).toHaveLength(1);
  });

  it("refuses a person whose invitation was accepted: they use Forgot password", async () => {
    await sql`update auth.users set email_confirmed_at = now(), invited_at = now() - interval '2 minutes' where email = 'fay@example.com'`;
    const fay = (await sql<{ id: string }[]>`select id::text from account.people where email = 'fay@example.com'`)[0].id;
    expect(await invite(deps(), token(DEE), fay)).toEqual({ status: 409, body: { error: "has-login" } });
  });

  it("links an account that already exists (for example made by HR) and sends nothing", async () => {
    await sql`insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000a1', 'Gus@Example.com', now())`;
    const gus = await addPerson("gus@example.com", "Gus");
    expect(await invite(deps(), token(DEE), gus)).toEqual({ status: 200, body: { result: "linked" } });
    const [person] = await sql`select auth_user_id::text from account.people where id = ${gus}::uuid`;
    expect(person.auth_user_id).toBe("00000000-0000-0000-0000-0000000000a1");
    expect(mails).toHaveLength(0);
  });

  it("never links an account that belongs to another person, a gone account, or an inactive person", async () => {
    // Ann's account is Ann's; a second person with an email that matches it in another case is refused.
    await sql`update account.people set email = 'ann.old@example.com' where auth_user_id = ${ANN}::uuid`;
    const twin = await addPerson("ann@example.com", "Ann Twin");
    expect(await invite(deps(), token(DEE), twin)).toEqual({ status: 409, body: { error: "account-taken" } });
    await sql`delete from account.people where id = ${twin}::uuid`;
    await sql`update account.people set email = 'ann@example.com' where auth_user_id = ${ANN}::uuid`;

    await sql`insert into auth.users (id, email, invited_at, deleted_at) values ('00000000-0000-0000-0000-0000000000a2', 'gone@example.com', now() - interval '1 day', now())`;
    const gone = await addPerson("gone@example.com", "Gone", "00000000-0000-0000-0000-0000000000a2");
    expect(await invite(deps(), token(DEE), gone)).toEqual({ status: 409, body: { error: "account-missing" } });

    const ida = await addPerson("ida@example.com", "Ida");
    await sql`update account.people set is_active = false where id = ${ida}::uuid`;
    expect(await invite(deps(), token(DEE), ida)).toEqual({ status: 404, body: { error: "no-person" } });
    expect(mails).toHaveLength(0);
  });

  it("refuses a blocked account", async () => {
    const ben = (await sql<{ id: string }[]>`select id::text from account.people where auth_user_id = ${BEN}::uuid`)[0].id;
    expect(await invite(deps(), token(DEE), ben)).toEqual({ status: 409, body: { error: "account-blocked" } });
  });

  it("gives the admin the link to pass on when the email could not be sent", async () => {
    mailMode = "off";
    const jo = await addPerson("jo@example.com", "Jo");
    const off = await invite(deps(), token(DEE), jo);
    expect(off.body.result).toBe("mail-off");
    expect(String(off.body.link)).toMatch(/^https:\/\/account\.example\/accept\?type=invite&token_hash=/);
    mailMode = "fail";
    await sql`update auth.users set invited_at = now() - interval '2 minutes' where email = 'jo@example.com'`;
    expect((await invite(deps(), token(DEE), jo)).body.result).toBe("mail-failed");
  });

  it("stops at once when the admin loses the right to manage", async () => {
    const kim = await addPerson("kim@example.com", "Kim");
    await sql`insert into account.person_actions (person_id, action_key, allowed) values (${deeId}::uuid, 'account_center.manage', false)`;
    expect(await invite(deps(), token(DEE), kim)).toEqual({ status: 403, body: { error: "not-allowed" } });
    await sql`delete from account.person_actions where person_id = ${deeId}::uuid`;
  });
});

describe("account-recover", () => {
  it("always gives the same answer, and emails only an active person with a working login", async () => {
    const same = { status: 200, body: { ok: true } };
    expect(await recover(deps(), "nobody@example.com")).toEqual(same);   // no account
    expect(await recover(deps(), "ben@example.com")).toEqual(same);      // login blocked
    expect(await recover(deps(), "cat@example.com")).toEqual(same);      // left (inactive)
    expect(mails).toHaveLength(0);
    expect(await recover(deps(), "  Ann@Example.com ")).toEqual(same);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toBe("ann@example.com");
    expect(linkOf(mails[0])).toMatch(/^https:\/\/account\.example\/accept\?type=recovery&token_hash=hash-\d+$/);
  });

  it("sends at most one link a minute", async () => {
    expect(await recover(deps(), "ann@example.com")).toEqual({ status: 200, body: { ok: true } });
    expect(mails).toHaveLength(0);
    await sql`update auth.users set recovery_sent_at = now() - interval '2 minutes' where id = ${ANN}::uuid`;
    await recover(deps(), "ann@example.com");
    expect(mails).toHaveLength(1);
  });

  it("refuses something that is not an email", async () => {
    expect((await recover(deps(), "not an email")).status).toBe(400);
    expect((await recover(deps(), 42)).status).toBe(400);
  });
});
