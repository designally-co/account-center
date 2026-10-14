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

// Every page and every action calls this first. No account: sign in. No access: a page that says so.
export async function requireAction(action: string): Promise<{ userId: string; me: Me }> {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const sql = db();
  if (!(await canUser(sql, userId, action))) redirect("/no-access");
  const me = await meByUser(sql, userId);
  if (!me) redirect("/no-access");
  return { userId, me };
}
