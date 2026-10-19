// Account Center's two server functions in Project Friday, account-invite and account-recover.
// The logic lives here, in plain TypeScript with no Deno globals, so the same code runs in the Edge Function
// (Deno, supabase/functions/*/index.ts) and in the tests (Node, test/app/functions.test.ts).
//
// Why server functions: they hold Friday's master key (service role) inside Supabase, so Account Center's
// own server never does. The one-time links they make go straight to the person's inbox; Account Center
// sees a link only when the email could not be sent, so the admin can pass it on by hand.
import type postgres from "postgres";

export type Mail = { to: string; subject: string; html: string; text: string };
export type MailResult = { ok: true } | { ok: false; skipped: true } | { ok: false; error: string };

export type Deps = {
  sql: postgres.Sql;          // Friday's database, as the function's own connection
  authUrl: string;            // Friday's Auth, e.g. https://<ref>.supabase.co/auth/v1
  serviceKey: string;         // Friday's service role key (stays inside the function)
  appUrl: string;             // where the links open, e.g. https://account.designally.co
  orgName: string;            // the company name in the emails (a setting, not code)
  sendMail: (mail: Mail) => Promise<MailResult>;
};

export type Reply = { status: number; body: Record<string, unknown> };

// One email per person per minute: invitations sent again, and reset links.
const WAIT_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// account-invite: an Account Center admin gives a person a login.
// - The person must already be in Account Center's list (added by the admin a moment before), active.
// - If an account with their email already exists (for example HR made it), it is linked; no email.
// - Otherwise an invited account is made (no password yet) and the invitation is emailed. Sent again
//   while the person has not accepted, it makes a new link (the old one stops working).
// - A person whose login already works is refused: they use "Forgot password" instead.
// The caller is checked twice: their sign-in token with Friday's Auth, then their rights in schema
// account, under the same lock every Account Center change takes.
export async function invite(deps: Deps, bearer: string | null, personId: unknown): Promise<Reply> {
  if (typeof personId !== "string" || !UUID.test(personId)) return reply(400, { error: "bad-request" });
  const callerId = bearer ? await signedInUser(deps, bearer) : null;
  if (!callerId) return reply(401, { error: "not-allowed" });

  type Plan = { kind: "linked" } | { kind: "send"; email: string; name: string; link: string };
  let plan: Plan;
  try {
    plan = await deps.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('account.changes'))`;
      const [actor] = await tx<{ id: string }[]>`
        select p.id::text from account.people p
        where p.auth_user_id = ${callerId}::uuid
          and account.can_user(p.auth_user_id, 'account_center.view')
          and account.can_user(p.auth_user_id, 'account_center.manage')`;
      if (!actor) throw new Refusal(403, "not-allowed");
      await tx`select set_config('account.actor', ${actor.id}, true)`;

      const [person] = await tx<{ email: string; display_name: string; auth_user_id: string | null }[]>`
        select email, display_name, auth_user_id::text from account.people
        where id = ${personId}::uuid and is_active for update`;
      if (!person) throw new Refusal(404, "no-person");

      // Which account: the one already linked, or the one with this email.
      const [account] = person.auth_user_id
        ? await tx<AuthRow[]>`select id::text, email, invited_at, email_confirmed_at, banned_until, deleted_at
                              from auth.users where id = ${person.auth_user_id}::uuid`
        : await tx<AuthRow[]>`select id::text, email, invited_at, email_confirmed_at, banned_until, deleted_at
                              from auth.users where lower(email) = ${person.email} and deleted_at is null`;

      // Linked to an account that is gone: never make a second one behind the person's back.
      if (person.auth_user_id && (!account || account.deleted_at)) throw new Refusal(409, "account-missing");
      if (account && !person.auth_user_id && !isPending(account)) {
        // An account that already works (HR made it): link it, send nothing.
        const [other] = await tx`select 1 from account.people where auth_user_id = ${account.id}::uuid`;
        if (other) throw new Refusal(409, "account-taken");
        await tx`update account.people set auth_user_id = ${account.id}::uuid where id = ${personId}::uuid`;
        return { kind: "linked" } as Plan;
      }
      if (account && isBlocked(account)) throw new Refusal(409, "account-blocked");
      if (account && !isPending(account)) throw new Refusal(409, "has-login");
      if (account && account.invited_at && secondsSince(account.invited_at) < WAIT_SECONDS) throw new Refusal(429, "too-soon");

      // A new invited account, or a new link for one not accepted yet. Friday's Auth makes the link.
      const made = await generateLink(deps, "invite", account?.email ?? person.email, { display_name: person.display_name });
      if (!made) throw new Refusal(502, "auth-failed");
      if (!person.auth_user_id) {
        const [other] = await tx`select 1 from account.people where auth_user_id = ${made.userId}::uuid`;
        if (other) throw new Refusal(409, "account-taken");
        await tx`update account.people set auth_user_id = ${made.userId}::uuid where id = ${personId}::uuid`;
      }
      return { kind: "send", email: made.email, name: person.display_name, link: acceptLink(deps, "invite", made.tokenHash) } as Plan;
    });
  } catch (error) {
    if (error instanceof Refusal) return reply(error.status, { error: error.code });
    throw error;
  }

  if (plan.kind === "linked") return reply(200, { result: "linked" });
  const sent = await deps.sendMail(inviteMail(deps, plan.email, plan.name, plan.link));
  if (sent.ok) return reply(200, { result: "sent" });
  // Not sent: the admin gets the link to pass on by hand (LINE or email), like HR's invite link.
  return reply(200, { result: "skipped" in sent ? "mail-off" : "mail-failed", link: plan.link });
}

// ---------------------------------------------------------------------------------------------
// account-recover: "Forgot password". Open to anyone, so it never says whether an email has an account:
// the answer is always the same. A link is emailed only to an active person in Account Center's list
// whose login is not blocked, at most once a minute.
export async function recover(deps: Deps, rawEmail: unknown): Promise<Reply> {
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return reply(400, { error: "bad-request" });
  const same = reply(200, { ok: true });

  const [row] = await deps.sql<(AuthRow & { recovery_sent_at: Date | null })[]>`
    select u.id::text, u.email, u.invited_at, u.email_confirmed_at, u.banned_until, u.deleted_at, u.recovery_sent_at
    from account.people p join auth.users u on u.id = p.auth_user_id
    where p.email = ${email} and p.is_active and u.deleted_at is null`;
  if (!row || isBlocked(row)) return same;
  if (row.recovery_sent_at && secondsSince(row.recovery_sent_at) < WAIT_SECONDS) return same;

  const made = await generateLink(deps, "recovery", row.email, undefined);
  if (!made) return same;
  const sent = await deps.sendMail(recoveryMail(deps, made.email, acceptLink(deps, "recovery", made.tokenHash)));
  if (!sent.ok && !("skipped" in sent)) console.error("[account-recover] the reset email was not sent");
  return same;
}

// ---------------------------------------------------------------------------------------------
type AuthRow = {
  id: string; email: string; invited_at: Date | null; email_confirmed_at: Date | null;
  banned_until: Date | null; deleted_at: Date | null;
};

class Refusal extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

function reply(status: number, body: Record<string, unknown>): Reply {
  return { status, body };
}

// Invited, and the invitation not accepted yet.
function isPending(a: AuthRow): boolean {
  return a.invited_at !== null && a.email_confirmed_at === null;
}

function isBlocked(a: AuthRow): boolean {
  return a.banned_until !== null && new Date(a.banned_until).getTime() > Date.now();
}

function secondsSince(at: Date): number {
  return (Date.now() - new Date(at).getTime()) / 1000;
}

function authHeaders(deps: Deps, bearer: string): Record<string, string> {
  return { apikey: deps.serviceKey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" };
}

// The caller's account id, checked by Friday's Auth (a token that is expired or made up gets null).
async function signedInUser(deps: Deps, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${deps.authUrl}/user`, { headers: authHeaders(deps, token) });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return typeof user.id === "string" && UUID.test(user.id) ? user.id : null;
  } catch {
    return null;
  }
}

async function generateLink(deps: Deps, type: "invite" | "recovery", email: string, data: Record<string, string> | undefined):
  Promise<{ userId: string; email: string; tokenHash: string } | null> {
  try {
    const res = await fetch(`${deps.authUrl}/admin/generate_link`, {
      method: "POST",
      headers: authHeaders(deps, deps.serviceKey),
      body: JSON.stringify({ type, email, ...(data ? { data } : {}) }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: string; email?: string; hashed_token?: string };
    if (!body.id || !body.hashed_token || !body.email) return null;
    return { userId: body.id, email: body.email, tokenHash: body.hashed_token };
  } catch {
    return null;
  }
}

// The link opens Account Center's /accept page, which asks for one click before it uses the link (so an
// email scanner that opens links cannot use it up).
function acceptLink(deps: Deps, type: "invite" | "recovery", tokenHash: string): string {
  const url = new URL("/accept", deps.appUrl);
  url.searchParams.set("type", type);
  url.searchParams.set("token_hash", tokenHash);
  return url.toString();
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function mailHtml(lines: string[], button: string, link: string): string {
  const body = lines.map((l) => `<p style="margin:0 0 14px">${escapeHtml(l)}</p>`).join("");
  return `<div style="font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#111111;max-width:480px">` +
    body +
    `<p style="margin:22px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:500">${escapeHtml(button)}</a></p>` +
    `<p style="margin:0;color:#6d6d6d;font-size:13px">If the button does not work, open this link: ${escapeHtml(link)}</p></div>`;
}

export function inviteMail(deps: Deps, to: string, name: string, link: string): Mail {
  const lines = [
    `Hello ${name},`,
    `You have a new ${deps.orgName} account. Accept the invitation to set your password and make your avatar.`,
    "The link works once and stops working after a while. If it has stopped working, ask your admin to send the invitation again.",
  ];
  return {
    to,
    subject: `Your ${deps.orgName} account`,
    html: mailHtml(lines, "Accept the invitation", link),
    text: `${lines.join("\n\n")}\n\nAccept the invitation: ${link}\n`,
  };
}

export function recoveryMail(deps: Deps, to: string, link: string): Mail {
  const lines = [
    `Someone asked to reset the password of your ${deps.orgName} account.`,
    "If it was you, choose a new password with the button below. The link works once and stops working after a while.",
    "If it was not you, ignore this email: your password stays the same.",
  ];
  return {
    to,
    subject: `Reset your ${deps.orgName} password`,
    html: mailHtml(lines, "Choose a new password", link),
    text: `${lines.join("\n\n")}\n\nChoose a new password: ${link}\n`,
  };
}

// ---------------------------------------------------------------------------------------------
// Email through Resend, the same provider HR's server functions use. Never throws: an email that could
// not be sent is a normal answer. Without a key nothing is sent and nothing is logged (the email holds a
// one-time link).
export function resendSender(opts: { apiKey: string | undefined; from: string; endpoint?: string }) {
  return async (mail: Mail): Promise<MailResult> => {
    if (!opts.apiKey) return { ok: false, skipped: true };
    try {
      const res = await fetch(opts.endpoint ?? "https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: opts.from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      });
      return res.ok ? { ok: true } : { ok: false, error: `Resend responded ${res.status}` };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "send failed" };
    }
  };
}
