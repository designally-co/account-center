"use client";

import { closeDialog } from "@/components/motion";
import { forwardRef, useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { setTeamMemberAction } from "./actions";

export type PickPerson = { id: string; name: string; team: string | null; extra_teams: string[]; avatar: unknown };

const ERRORS: Record<string, string> = {
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
  inactive: "Not saved: that person was removed.",
  "unknown-team": "Not saved: this team no longer exists. Reload the page.",
  "not-found": "Not saved: that person was not found. Reload the page.",
};

// "Add people" from the team's "…" menu (Buk, 2026-11-03: "add people must be in the more action"). A window with
// everyone active: find someone, then Add or Remove. Someone already in another team keeps it and gets this one
// as an extra team; someone in no team gets it as their primary team. Each press saves at once.
export const TeamPeopleDialog = forwardRef<HTMLDialogElement, {
  teamId: string; teamName: string; people: PickPerson[]; members: string[]; leads: string[];
}>(function TeamPeopleDialog({ teamId, teamName, people, members, leads }, ref) {
  const router = useRouter();
  const titleId = useId();
  const [inTeam, setInTeam] = useState<string[]>(members);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const saved = members.join(",");
  useEffect(() => { setInTeam(saved ? saved.split(",") : []); }, [saved]);

  const q = query.trim().toLowerCase();
  // People in the team first, then everyone else, each by name.
  const list = useMemo(() => [...people]
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.team ?? "").toLowerCase().includes(q))
    .sort((a, b) => Number(inTeam.includes(b.id)) - Number(inTeam.includes(a.id)) || a.name.localeCompare(b.name)),
  [people, q, inTeam]);

  const where = (p: PickPerson) => leads.includes(p.id) ? "Lead of this team"
    : p.team === teamName ? "Primary team"
    : p.extra_teams.includes(teamName) ? `Extra team · primary ${p.team}`
    : p.team ? `In ${p.team} · joins as an extra team` : "No team · this becomes their primary team";

  const toggle = (id: string, on: boolean) => {
    setError(null);
    setInTeam((all) => on ? [...all, id] : all.filter((x) => x !== id));
    startTransition(async () => {
      const result = await setTeamMemberAction(teamId, id, on);
      if (result !== "saved") {
        setError(ERRORS[result] ?? "Not saved. Reload the page and try again.");
        router.refresh();
      }
    });
  };

  return (
    <dialog ref={ref} className="modal people-dialog" aria-labelledby={titleId}>
      <div className="stack">
        <div className="modal-head">
          <h2 id={titleId}>People in {teamName}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={(e) => closeDialog(e.currentTarget.closest("dialog"))}>
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <label className="search">
          <Search size={15} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Find a person</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find by name or team" autoComplete="off" spellCheck={false} />
        </label>
        {error ? <p className="notice error" role="alert">{error}</p> : null}
        <ul className="people-pick" aria-label="Everyone">
          {list.map((p) => {
            const on = inTeam.includes(p.id);
            return (
              <li key={p.id} className={on ? "on" : undefined}>
                <Avatar avatar={p.avatar} seed={p.id} size={32} />
                <span className="people-pick-text">
                  <strong>{p.name}</strong>
                  <span>{on ? where({ ...p, team: p.team ?? teamName }) : where(p)}</span>
                </span>
                <button type="button" className={on ? "secondary small" : "small"} aria-pressed={on}
                  aria-label={`${on ? "Remove" : "Add"} ${p.name}`} onClick={() => toggle(p.id, !on)}>
                  {on ? "Remove" : "Add"}
                </button>
              </li>
            );
          })}
          {list.length === 0 ? <li className="empty">No one matches.</li> : null}
        </ul>
      </div>
    </dialog>
  );
});
