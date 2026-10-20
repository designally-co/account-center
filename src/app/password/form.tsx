"use client";

import { useActionState } from "react";
import { setPasswordAction, type PasswordState } from "./actions";

export function PasswordForm({ askCurrent }: { askCurrent: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(setPasswordAction, {});
  return (
    <form action={action} className="stack">
      {askCurrent ? (
        <label className="field">
          <span>Current password</span>
          <input name="current_password" type="password" autoComplete="current-password" required />
        </label>
      ) : null}
      <label className="field">
        <span>New password</span>
        <input name="new_password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-describedby="password-rule" />
      </label>
      <label className="field">
        <span>New password again</span>
        <input name="confirm_password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </label>
      <p id="password-rule" className="muted small-text">At least 8 characters, with letters and numbers.</p>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Saving..." : "Save password"}</button>
    </form>
  );
}
