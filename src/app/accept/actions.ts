"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type AcceptState = { error?: "invite" | "recovery" };

const TOKEN = /^[A-Za-z0-9_-]{16,200}$/;

// The one click that uses an invitation or reset link. Friday's Auth checks the link (once only, and only
// while it is fresh) and signs the person in; then they choose their password.
export async function acceptAction(_: AcceptState, form: FormData): Promise<AcceptState> {
  const type = form.get("type") === "recovery" ? "recovery" : "invite";
  const tokenHash = String(form.get("token_hash") ?? "");
  if (!TOKEN.test(tokenHash)) return { error: type };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return { error: type };
  redirect(type === "invite" ? "/password?welcome=1" : "/password");
}
