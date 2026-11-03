"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Assignees } from "@/components/assignees";
import { avatarDataUri, defaultAvatar, parseAvatar } from "@/lib/avatar";
import { setTeamMemberAction } from "./actions";

export type PickPerson = { id: string; name: string; team: string | null; extra_teams: string[]; avatar: unknown };

const ERRORS: Record<string, string> = {
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
  inactive: "Not saved: that person was removed.",
  "unknown-team": "Not saved: this team was turned off. Reload the page.",
  "not-found": "Not saved: that person was not found. Reload the page.",
};

// A team's members, as Bencho's Assignees pill, on the team's own page (Buk, 2026-11-02: "use this for the
// team card adding team members"; 2026-11-03: "user must go inside first to add the team member", so it moved
// from the card on Teams into the team's page). Ticking someone adds this team: as an extra team when they
// already have a primary team, else as their primary team (Buk, 2026-11-03). Unticking takes them off this
// team only. The pill changes at once; the save runs behind it and the page refreshes when it is done.
export function TeamMembers({ teamId, teamName, people, members, leads }: {
  teamId: string; teamName: string; people: PickPerson[]; members: string[]; leads: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Avatars are drawn here from each person's small choices, not sent as pictures: one picture is about
  // 23 KB, and the list holds everyone.
  const list = useMemo(() => people.map((p) => ({
    id: p.id,
    name: p.name,
    role: leads.includes(p.id) ? "Lead of this team"
      : p.team === teamName ? "Primary team"
      : p.extra_teams.includes(teamName) ? `Extra team · primary ${p.team}`
      : p.team ? `In ${p.team} · joins as extra team` : "No team · becomes primary team",
    avatar: avatarDataUri(parseAvatar(p.avatar) ?? defaultAvatar(p.id)),
  })), [people, teamName, leads]);

  const onToggle = (personId: string, on: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setTeamMemberAction(teamId, personId, on);
      if (result !== "saved") {
        setError(ERRORS[result] ?? "Not saved. Reload the page and try again.");
        router.refresh();
      }
    });
  };

  return (
    <div className="team-members-pick">
      <Assignees people={list} value={members} onToggle={onToggle} label={`Members of ${teamName}`} fit stroke />
      {error ? <p className="error small-text" role="alert">{error}</p> : null}
    </div>
  );
}
