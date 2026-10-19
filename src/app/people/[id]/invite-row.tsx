"use client";

import { useActionState } from "react";
import type { InviteState } from "../actions";
import { inviteMessage } from "../invite-messages";
import { InviteLink } from "../invite-link";
import { SaveNotice, SubmitButton } from "./access-form";

// For someone without a working login yet: send the invitation (again). Shown to admins only.
export function InviteRow({ action, personId, invited }: {
  action: (state: InviteState, form: FormData) => Promise<InviteState>;
  personId: string;
  invited: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const shown = inviteMessage(state.notice);
  return (
    <div className="detail-row">
      <span className="detail-label">Sign-in</span>
      <div className="row">
        <span className="muted">{invited ? "Invitation not accepted yet" : "No login yet"}</span>
        <form action={formAction}>
          <input type="hidden" name="person_id" value={personId} />
          <SubmitButton className="secondary small" pendingText="Sending…">{invited ? "Send again" : "Send invitation"}</SubmitButton>
        </form>
      </div>
      {shown ? (
        <div className="detail-notice stack">
          <SaveNotice key={state.n} tone={shown.tone} text={shown.text} />
          {state.link ? <InviteLink link={state.link} /> : null}
        </div>
      ) : null}
    </div>
  );
}
