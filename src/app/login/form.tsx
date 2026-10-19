"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type SignInState } from "../actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={action} className="stack">
      <label className="field">
        <span>Email</span>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
      <p><Link href="/forgot-password" className="back">Forgot your password?</Link></p>
    </form>
  );
}
