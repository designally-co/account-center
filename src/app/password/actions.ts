"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { meByUser } from "@/lib/access";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { currentSignIn } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export type PasswordState = { error?: string };

// The same rule as HR's own password form: at least 8 characters, with letters and numbers.
function passwordProblem(password: string): string | null {
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Use at least 8 characters, with letters and numbers.";
  }
  // Friday's Auth stores at most 72 bytes; Thai letters take 3 bytes each.
  if (new TextEncoder().encode(password).length > 72) return "That password is too long. Use a shorter one.";
  return null;
}

// A person chooses their own password: after an invitation or reset link, or any time from Home. Without a
// fresh link, they type their current password first. The server decides which, never the form.
export async function setPasswordAction(_: PasswordState, form: FormData): Promise<PasswordState> {
  const signIn = await currentSignIn();
  if (!signIn) redirect("/login");
  const me = await meByUser(db(), signIn.userId);
  if (!me) redirect("/no-access");

  const next = String(form.get("new_password") ?? "");
  const again = String(form.get("confirm_password") ?? "");
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== again) return { error: "The two new passwords are not the same." };

  if (!signIn.byLinkRecently) {
    const current = String(form.get("current_password") ?? "");
    if (!current) return { error: "Type your current password." };
    // Checked on its own, without touching this browser's sign-in; the extra session it makes is ended.
    const check = createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await check.auth.signInWithPassword({ email: signIn.email, password: current });
    if (error) return { error: "Your current password is not right." };
    await check.auth.signOut({ scope: "local" });
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) {
    if (error.code === "same_password") return { error: "That is already your password. Choose a new one." };
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Choose another one." };
    if (error.code === "validation_failed") return { error: "That password cannot be used. Choose another one." };
    return { error: "Not saved. Try again in a minute." };
  }
  // Other browsers signed in to this account are signed out, in case someone else had the old password.
  await supabase.auth.signOut({ scope: "others" });
  redirect(me.avatar === null ? "/avatar?welcome=1" : "/?notice=password-saved");
}
