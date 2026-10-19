"use client";

import { useState } from "react";

// The person's kind, with Save shown only after a change (like the app panels).
export function KindForm({ save, personId, kinds, current, locked }: {
  save: (form: FormData) => Promise<void>;
  personId: string;
  kinds: { key: string; name: string }[];
  current: string;
  locked: boolean;
}) {
  const [kind, setKind] = useState(current);
  return (
    <form action={save} className="detail-row">
      <input type="hidden" name="person_id" value={personId} />
      <label htmlFor="kind" className="detail-label">Kind</label>
      <span className="row">
        <select id="kind" name="kind" value={kind} disabled={locked} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => <option key={k.key} value={k.key}>{k.name}</option>)}
        </select>
        {!locked && kind !== current ? <button type="submit" className="small">Save</button> : null}
      </span>
    </form>
  );
}
