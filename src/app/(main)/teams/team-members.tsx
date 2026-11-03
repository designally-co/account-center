"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Assignees } from "@/components/assignees";
import { avatarDataUri, defaultAvatar, parseAvatar } from "@/lib/avatar";
import { setTeamMemberAction } from "./actions";

export type PickPerson = { id: string; name: string; team: string | null; is_lead: boolean; avatar: unknown };

const ERRORS: Record<string, string> = {
  "not-allowed": "Not saved: you can no longer manage Account Center. Ask another admin.",
  inactive: "Not saved: that person was removed.",
  "unknown-team": "Not saved: this team was turned off. Reload the page.",
  "not-found": "Not saved: that person was not found. Reload the page.",
};

// A team card's members, as Bencho's Assignees pill (Buk, 2026-11-02: "use this for the team card adding team
// members"). Ticking someone puts them in this team, moving them out of their old one; unticking takes them
// off. The pill changes at once; the save runs behind it and the page refreshes when it is done.
export function TeamMembers({ teamId, teamName, people, members }: { teamId: string; teamName: string; people: PickPerson[]; members: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Avatars are drawn here from each person's small choices, not sent as pictures: one picture is about
  // 23 KB, and every card lists everyone.
  const list = useMemo(() => people.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.team === teamName ? (p.is_lead ? "Lead of this team" : "In this team") : p.team ? `In ${p.team}: moves here` : "No team",
    avatar: avatarDataUri(parseAvatar(p.avatar) ?? defaultAvatar(p.id)),
  })), [people, teamName]);

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
    <div className="team-card-members">
      <Assignees people={list} value={members} onToggle={onToggle} label={`Members of ${teamName}`} fit stroke />
      {error ? <p className="error small-text" role="alert">{error}</p> : null}
    </div>
  );
}
