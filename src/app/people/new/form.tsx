"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addPersonAction, type AddState } from "../actions";
import { inviteMessage } from "../invite-messages";
import { InviteLink } from "../invite-link";

const ERRORS: Record<string, string> = {
  "invalid-name": "Type their name (100 characters or fewer).",
  "invalid-email": "That does not look like an email address.",
  "invalid-kind": "Choose a kind.",
  "work-email-of-another": "That email is already someone else's work email.",
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
};

export function NewPersonForm({ kinds }: { kinds: { key: string; name: string }[] }) {
  const [state, action, pending] = useActionState<AddState, FormData>(addPersonAction, {});

  if (state.personId && state.link) {
    const message = inviteMessage(state.mail);
    return (
      <section className="panel stack">
        <h2>{state.name} was added</h2>
        {message ? <p className={`notice ${message.tone}`} role="alert">{message.text}</p> : null}
        <InviteLink link={state.link} />
        <p><Link href={`/people/${state.personId}`} className="button">Open their page</Link></p>
      </section>
    );
  }

  const error = state.error === "taken" ? null : state.error && Object.hasOwn(ERRORS, state.error) ? ERRORS[state.error] : null;
  return (
    <form action={action} className="panel stack new-person">
      <label className="field">
        <span>Name</span>
        <input name="name" autoComplete="off" maxLength={100} required />
      </label>
      <label className="field">
        <span>Google email</span>
        <input name="email" type="email" autoComplete="off" placeholder="name@gmail.com" required aria-describedby="email-help" />
        <span id="email-help" className="muted small-text">The invitation goes here, and they sign in with it.</span>
      </label>
      <label className="field">
        <span>Kind</span>
        <select name="kind" defaultValue={kinds[0]?.key} required>
          {kinds.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
        </select>
      </label>
      {state.error === "taken" && state.existingId ? (
        <p className="error" role="alert">This email is already in Account Center. <Link href={`/people/${state.existingId}`}>Open their page</Link></p>
      ) : error ? <p className="error" role="alert">{error}</p> : null}
      <div className="row">
        <button type="submit" disabled={pending}>{pending ? "Adding..." : "Add and send invitation"}</button>
        <Link href="/people" className="button secondary">Cancel</Link>
      </div>
    </form>
  );
}
