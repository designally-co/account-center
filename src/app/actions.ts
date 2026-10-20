"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { meByUser } from "@/lib/access";
import { db } from "@/lib/db";
import { AVATAR_LATER_COOKIE } from "@/lib/self";
import { supabaseServer } from "@/lib/supabase/server";

export type SignInState = { error?: string };

export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Type your email and your password." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "This email and password do not match an account. Check them and try again." };
  // The first time in, a person makes their avatar (unless they chose "Later" on this browser).
  const me = await meByUser(db(), data.user.id);
  const later = (await cookies()).get(AVATAR_LATER_COOKIE)?.value === "1";
  redirect(me && me.avatar === null && !later ? "/avatar?welcome=1" : "/");
}

export async function signOut() {
  const supabase = await supabaseServer();
  // Only this browser: the same Friday account is also signed in to HR and Blink, which must stay signed in
  // (the library's default would end every session of the account, everywhere).
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
