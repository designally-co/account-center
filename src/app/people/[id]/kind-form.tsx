"use client";

import { useActionState, useState } from "react";
import type { KindNotice } from "./actions";
import { SaveNotice, SubmitButton } from "./access-form";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "kind-saved": { tone: "ok", text: "Employment type saved." },
  "kind-yourself": { tone: "error", text: "You cannot change your own employment type. Ask another admin." },
  "unknown-kind": { tone: "error", text: "That employment type does not exist. Reload the page and try again." },
  inactive: { tone: "error", text: "This person was removed. Their employment type cannot be changed." },
  "not-found": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

// The person's kind, with Save shown only after a change (like the app panels). The answer appears here.
export function KindForm({ save, personId, personName, kinds, appNames, current, locked }: {
  save: (state: KindNotice, form: FormData) => Promise<KindNotice>;
  personId: string;
  personName: string;
  kinds: { key: string; name: string }[];
  appNames: Record<string, string>;
  current: string;
  locked: boolean;
}) {
  const [kind, setKind] = useState(current);
  const [state, action] = useActionState(save, {});
  const app = state.app && Object.hasOwn(appNames, state.app) ? appNames[state.app] : "an app";
  const message = state.notice === "kind-blocked"
    ? { tone: "error" as const, text: `Not saved: that employment type can never use ${app}, and ${personName} still has access there. In ${app} below, choose "No access" and save. Then change the employment type.` }
    : state.notice && Object.hasOwn(MESSAGES, state.notice) ? MESSAGES[state.notice] : null;
  return (
    <form action={action} className="detail-row">
      <input type="hidden" name="person_id" value={personId} />
      <label htmlFor="kind" className="detail-label">Employment type</label>
      <span className="row">
        <select id="kind" name="kind" value={kind} disabled={locked} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
        </select>
        {!locked && kind !== current ? <SubmitButton className="small" pendingText="Saving…">Save</SubmitButton> : null}
      </span>
      {message ? <div className="detail-notice"><SaveNotice key={state.n} tone={message.tone} text={message.text} /></div> : null}
    </form>
  );
}
