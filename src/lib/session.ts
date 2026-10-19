import { redirect } from "next/navigation";
import { canUser, meByUser, type Me } from "./access";
import { db } from "./db";
import { supabaseServer } from "./supabase/server";

// The signed-in account, checked with Friday's Auth server (not only read from the cookie).
export async function currentUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

// Pages every company person may open (their own access and avatar): a signed-in, active person with a
// working login. No account: sign in. Not in Account Center's list, removed or blocked: a page that says so.
export async function requirePerson(): Promise<{ userId: string; me: Me }> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const me = await meByUser(db(), userId);
  if (!me) redirect("/no-access");
  return { userId, me };
}

// Every admin page and every admin action calls this first. No account: sign in. No access: a page that says so.
// A person without that right goes back to Home, which says so.
export async function requireAction(action: string): Promise<{ userId: string; me: Me }> {
  const { userId, me } = await requirePerson();
  if (!(await canUser(db(), userId, action))) redirect("/?notice=not-allowed");
  return { userId, me };
}

// How long after opening an invitation or reset link a person may choose a password without typing the
// old one.
const LINK_MINUTES = 30;

// The signed-in account and how it signed in: by an email link (invitation or reset) in the last
// LINK_MINUTES, or not. Friday's Auth writes the sign-in method and its time into the signed token ("amr");
// the token is checked with Friday's Auth first.
export async function currentSignIn(): Promise<{ userId: string; email: string; byLinkRecently: boolean } | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const { data: s } = await supabase.auth.getSession();
  let byLinkRecently = false;
  try {
    const part = s.session?.access_token.split(".")[1] ?? "";
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { sub?: string; amr?: { method?: string; timestamp?: number }[] };
    byLinkRecently = claims.sub === data.user.id && (claims.amr ?? []).some((a) =>
      a.method === "otp" && typeof a.timestamp === "number" && Date.now() / 1000 - a.timestamp < LINK_MINUTES * 60);
  } catch {
    byLinkRecently = false;
  }
  return { userId: data.user.id, email: data.user.email, byLinkRecently };
}
