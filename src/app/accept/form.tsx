"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptAction, type AcceptState } from "./actions";

export function AcceptForm({ type, tokenHash, button }: { type: "invite" | "recovery"; tokenHash: string; button: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptAction, {});
  if (state.error) {
    return (
      <div className="stack">
        <p className="notice error" role="alert">
          {state.error === "invite"
            ? "This invitation has expired or was already used. Ask your admin to send it again."
            : "This link has expired or was already used. Ask for a new one."}
        </p>
        {state.error === "recovery" ? <Link href="/forgot-password" className="button">Get a new link</Link> : <Link href="/login" className="button secondary">Go to sign-in</Link>}
      </div>
    );
  }
  return (
    <form action={action} className="stack">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="token_hash" value={tokenHash} />
      <button type="submit" disabled={pending}>{pending ? "One moment..." : button}</button>
    </form>
  );
}
