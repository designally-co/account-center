"use client";

import { useActionState } from "react";
import type { FormNotice } from "../actions";
import { SaveNotice, SubmitButton } from "./access-form";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "email-added": { tone: "ok", text: "Work email added." },
  "email-removed": { tone: "ok", text: "Work email removed." },
  "email-not-found": { tone: "error", text: "That work email was already gone." },
  invalid: { tone: "error", text: "That does not look like an email address." },
  taken: { tone: "error", text: "That email is already someone else's work email." },
  "main-email-of-another": { tone: "error", text: "That email is someone else's HR email." },
  "no-person": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-found": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

// Work emails let people who still sign in with Google be matched to their account.
export function WorkEmails({ action, personId, emails, canManage, canAdd }: {
  action: (state: FormNotice, form: FormData) => Promise<FormNotice>;
  personId: string;
  emails: string[];
  canManage: boolean;
  canAdd: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const shown = state.notice && Object.hasOwn(MESSAGES, state.notice) ? MESSAGES[state.notice] : null;
  return (
    <div className="detail-row">
      <span className="detail-label">Work emails</span>
      <div className="chips">
        {emails.map((e) => (
          <span key={e} className="chip">
            {e}
            {canManage ? (
              <form action={formAction}>
                <input type="hidden" name="op" value="remove" />
                <input type="hidden" name="person_id" value={personId} />
                <input type="hidden" name="email" value={e} />
                <SubmitButton className="chip-x" pendingText="…"><span aria-hidden="true">×</span><span className="sr-only">Remove {e}</span></SubmitButton>
              </form>
            ) : null}
          </span>
        ))}
        {canAdd ? (
          <form action={formAction} className="inline">
            <input type="hidden" name="op" value="add" />
            <input type="hidden" name="person_id" value={personId} />
            <label className="sr-only" htmlFor="work-email">Add a work email</label>
            <input id="work-email" name="email" type="email" placeholder="name@designally.co" required />
            <SubmitButton className="secondary small" pendingText="Adding…">Add</SubmitButton>
          </form>
        ) : emails.length === 0 ? <span className="muted">None</span> : null}
      </div>
      {shown ? <div className="detail-notice"><SaveNotice key={state.n} tone={shown.tone} text={shown.text} /></div> : null}
    </div>
  );
}
