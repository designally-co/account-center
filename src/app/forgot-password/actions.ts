"use server";

import { sendReset } from "@/lib/invites";
import { normalizeEmail } from "@/lib/people";

export type ForgotState = { done?: boolean; error?: string };

// "Forgot password": the answer never says whether the email has an account.
export async function forgotAction(_: ForgotState, form: FormData): Promise<ForgotState> {
  const email = normalizeEmail(form.get("email"));
  if (!email) return { error: "That does not look like an email address." };
  const result = await sendReset(email);
  if (result === "unreachable") return { error: "We could not send the email right now. Try again in a few minutes." };
  return { done: true };
}
