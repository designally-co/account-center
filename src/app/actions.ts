"use server";

import { redirect } from "next/navigation";
import { meByUser } from "@/lib/access";
import { db } from "@/lib/db";
import { supabaseServer } from "@/lib/supabase/server";

export type SignInState = { error?: string };

export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Type your email and your password." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "This email and password do not match an account. Check them and try again." };
  // The first time in, a person makes their avatar.
  const me = await meByUser(db(), data.user.id);
  redirect(me && me.avatar === null ? "/avatar?welcome=1" : "/");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
