"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";

// One app's default role for a team. Save shows only after the choice changes, like the other rows on the
// person page, so a page of ten apps is not ten Save buttons.
export function DefaultRole({ action, teamId, appKey, appName, roles, current, locked }: {
  action: (form: FormData) => Promise<void>;
  teamId: string;
  appKey: string;
  appName: string;
  roles: { key: string; name: string }[];
  current: string;
  locked: boolean;
}) {
  const [role, setRole] = useState(current);
  const changed = role !== current;
  return (
    <form id={`app-${appKey}`} action={action} className="detail-row">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="app" value={appKey} />
      <label htmlFor={`role-${appKey}`} className="detail-label">{appName}</label>
      <span className="row">
        <select id={`role-${appKey}`} name="role" value={role} disabled={locked} onChange={(e) => setRole(e.target.value)}>
          <option value="">No default</option>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
        </select>
        {!locked && changed ? (
          <span className="row pop-in">
            <button type="button" className="secondary small" onClick={() => setRole(current)}>Cancel</button>
            <SubmitButton className="small" pendingText="Saving…">Save</SubmitButton>
          </span>
        ) : null}
      </span>
    </form>
  );
}
