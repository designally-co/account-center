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
