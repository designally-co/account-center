"use client";

import { useActionState, useState } from "react";
import type { TeamNotice } from "./actions";
import { SaveNotice, SubmitButton } from "./access-form";
import { sendKept } from "@/components/send-kept";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "extra-teams-saved": { tone: "ok", text: "Extra teams saved. The apps below include their default access." },
  "no-primary": { tone: "error", text: "Choose a primary team first." },
  "unknown-team": { tone: "error", text: "One of those teams no longer exists. Reload the page and try again." },
  inactive: { tone: "error", text: "This person was removed. Their teams cannot be changed." },
  "not-found": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

// The teams a person works in besides their primary team (Buk, 2026-11-03: "Buk is from digital team but also
// the admin team"). Each one gives its default access too. Tick or untick; Save shows only after a change.
export function ExtraTeamsForm({ save, personId, teams, primary, current, locked }: {
  save: (state: TeamNotice, form: FormData) => Promise<TeamNotice>;
  personId: string;
  teams: { id: string; name: string }[];
  primary: string | null;              // the primary team's id
  current: { id: string; name: string }[];
  locked: boolean;
}) {
  const [picked, setPicked] = useState<string[]>(current.map((t) => t.id));
  const [state, action, pending] = useActionState(save, {});
  const message = state.notice && Object.hasOwn(MESSAGES, state.notice) ? MESSAGES[state.notice] : null;
  const changed = picked.length !== current.length || picked.some((id) => !current.some((t) => t.id === id));
  const choices = teams.filter((t) => t.id !== primary);
  return (
    <form onSubmit={sendKept(action)} className="detail-row">
      <input type="hidden" name="person_id" value={personId} />
      <span className="detail-label" id="extra-teams-label">Extra teams</span>
      {locked ? (
        <span className={current.length ? undefined : "muted"}>{current.length ? current.map((t) => t.name).join(", ") : "None"}</span>
      ) : !primary ? (
        <span className="muted">Choose a primary team first</span>
      ) : (
        <span className="row">
          {/* Toggle buttons plus hidden fields, not checkboxes: React resets a form's fields after it is sent, and
              checkboxes would then send the old ticks with the next save. */}
          {picked.map((id) => <input key={id} type="hidden" name="team" value={id} />)}
          <span className="team-toggles" role="group" aria-labelledby="extra-teams-label">
            {choices.map((t) => {
              const on = picked.includes(t.id);
              return (
                <button key={t.id} type="button" className={`team-toggle${on ? " on" : ""}`} aria-pressed={on}
                  onClick={() => setPicked((p) => p.includes(t.id) ? p.filter((id) => id !== t.id) : [...p, t.id])}>
                  {t.name}
                </button>
              );
            })}
          </span>
          {changed ? <SubmitButton className="small" pendingText="Saving…" pending={pending}>Save</SubmitButton> : null}
        </span>
      )}
      {message ? <div className="detail-notice"><SaveNotice key={state.n} tone={message.tone} text={message.text} /></div> : null}
    </form>
  );
}
