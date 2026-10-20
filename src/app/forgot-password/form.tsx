"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotAction, type ForgotState } from "./actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(forgotAction, {});
  if (state.done) {
    return (
      <div className="stack">
        <p className="notice ok" role="status">If this email belongs to an account, we sent a link to it. Check your inbox and your spam folder. The link works once.</p>
        <Link href="/login" className="button secondary">Back to sign-in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="username" required />
      </label>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Sending..." : "Send me a link"}</button>
      <p><Link href="/login" className="back">Back to sign-in</Link></p>
    </form>
  );
}
