"use client";

import { useActionState, useState } from "react";
import type { TeamNotice } from "./actions";
import { SaveNotice, SubmitButton } from "./access-form";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "team-saved": { tone: "ok", text: "Team saved. The apps below show the team's default access." },
  "unknown-team": { tone: "error", text: "That team does not exist or is turned off. Reload the page and try again." },
  inactive: { tone: "error", text: "This person was removed. Their team cannot be changed." },
  "not-found": { tone: "error", text: "That person was not found. Reload the page and try again." },
  "not-allowed": { tone: "error", text: "Not saved: you can no longer manage Account Center. Ask another admin." },
};

// The person's one team and whether they lead it, with Save shown only after a change (like Employment type).
export function TeamForm({ save, personId, teams, current, locked }: {
  save: (state: TeamNotice, form: FormData) => Promise<TeamNotice>;
  personId: string;
  teams: { id: string; name: string }[];
  current: { id: string; name: string; is_active: boolean; is_lead: boolean } | null;
  locked: boolean;
}) {
  const [team, setTeam] = useState(current?.id ?? "");
  const [lead, setLead] = useState(current?.is_lead ?? false);
  const [state, action] = useActionState(save, {});
  const message = state.notice && Object.hasOwn(MESSAGES, state.notice) ? MESSAGES[state.notice] : null;
  const changed = team !== (current?.id ?? "") || (team !== "" && lead !== (current?.is_lead ?? false));
  // A team that is turned off is still shown for the person in it, but nobody can be moved into it.
  const options = current && !current.is_active && !teams.some((t) => t.id === current.id)
    ? [...teams, { id: current.id, name: `${current.name} (turned off)` }]
    : teams;
  return (
    <form action={action} className="detail-row">
      <input type="hidden" name="person_id" value={personId} />
      <label htmlFor="team" className="detail-label">Team</label>
      <span className="row">
        <select id="team" name="team" value={team} disabled={locked}
          onChange={(e) => { setTeam(e.target.value); if (e.target.value !== current?.id) setLead(false); }}>
          <option value="">No team</option>
          {options.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {team ? (
          <label className="check">
            <input type="checkbox" name="is_lead" checked={lead} disabled={locked} onChange={(e) => setLead(e.target.checked)} />
            Team lead
          </label>
        ) : null}
        {!locked && changed ? <SubmitButton className="small" pendingText="Saving…">Save</SubmitButton> : null}
      </span>
      {message ? <div className="detail-notice"><SaveNotice key={state.n} tone={message.tone} text={message.text} /></div> : null}
    </form>
  );
}
