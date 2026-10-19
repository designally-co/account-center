import { env } from "./env";
import { supabaseServer } from "./supabase/server";

// Account Center's server asks the two server functions in Project Friday (supabase/functions/) to make
// logins and reset links. Friday's master key stays inside those functions; this server only passes on the
// signed-in admin's own token, and sees an invitation link only when its email could not be sent.

export type InviteResult =
  | { result: "sent" | "linked" }
  | { result: "mail-off" | "mail-failed"; link: string }
  | { error: string };

const INVITE_ERRORS = new Set([
  "bad-request", "not-allowed", "no-person", "account-taken", "account-missing", "account-blocked", "has-login",
  "too-soon", "auth-failed",
]);

function functionUrl(name: string): string {
  return `${env.supabaseUrl.replace(/\/+$/, "")}/functions/v1/${name}`;
}

export async function sendInvite(personId: string): Promise<InviteResult> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "not-allowed" };
  try {
    const res = await fetch(functionUrl("account-invite"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseKey, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ person_id: personId }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && (body.result === "sent" || body.result === "linked")) return { result: body.result };
    if (res.ok && (body.result === "mail-off" || body.result === "mail-failed") && typeof body.link === "string" && isAcceptLink(body.link)) {
      return { result: body.result, link: body.link };
    }
    return { error: typeof body.error === "string" && INVITE_ERRORS.has(body.error) ? body.error : "unreachable" };
  } catch {
    return { error: "unreachable" };
  }
}

// Only a link to this app's own accept page is ever shown to the admin.
function isAcceptLink(link: string): boolean {
  try {
    return new URL(link).pathname === "/accept";
  } catch {
    return false;
  }
}

// "Forgot password": the function always gives the same answer, so this says only whether it was reached.
export async function sendReset(email: string): Promise<"done" | "unreachable"> {
  try {
    const res = await fetch(functionUrl("account-recover"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.supabaseKey },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    return res.ok ? "done" : "unreachable";
  } catch {
    return "unreachable";
  }
}
