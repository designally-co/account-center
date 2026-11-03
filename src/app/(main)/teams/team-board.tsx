"use client";

import { useId, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Popup } from "@/components/popup";
import { Avatar } from "@/components/avatar";
import type { TeamDetail, TeamSummary } from "@/lib/teams";
import { TeamDetail as Detail } from "./team-detail";
import type { PickPerson } from "./team-people";

// The Teams page's cards, and each team as a popup over them (Buk, 2026-11-03: "each team page must be popup
// modal, not a page. and when user click the team in the teams page, show the small team card going bigger
// into a big popup modal"). Pressing a card grows that card into the team's card in the popup (GSAP, Buk:
// "use GSAP motion"), and closing shrinks it back into its place (src/components/popup.tsx).
//
// The open team is in the address (/teams?team=<id>): the browser's Back closes it, a link opens it, and a save
// inside it (a server action) comes back with the same address, so it stays open. Opening and closing change
// the address with the browser's own history calls, which Next.js follows, so nothing is asked of the server.
export function TeamBoard({ teams, details, people, canManage, canView, error }: {
  teams: TeamSummary[];
  details: Record<string, TeamDetail>;
  people: PickPerson[];
  canManage: boolean;     // an admin: sees and changes the settings
  canView: boolean;       // may open people's pages
  error: string | null;    // an error from the last save, about the team that is open
}) {
  const search = useSearchParams();
  const asked = search.get("team");
  const openId = asked && details[asked] ? asked : null;
  const team = openId ? details[openId] : null;
  const titleId = useId();
  const lastOpen = useRef<string | null>(null);
  if (openId) lastOpen.current = openId;
  const open = (id: string) => {
    window.history.pushState(null, "", `/teams?team=${id}`);
  };
  const close = () => {
    window.history.replaceState(null, "", "/teams");
  };
  const backToCard = () => document.querySelector<HTMLElement>(`.team-cards a.team-card-name[href="/teams?team=${lastOpen.current}"]`)?.focus();

  return (
    <>
      {teams.length === 0 ? <p className="empty">No teams yet.</p> : (
        <ul className="team-cards teams-grid" aria-label="Teams">
          {teams.map((t, i) => {
            // A card (Buk, 2026-11-03, "Frame 1"): the team's name large, its description, and its people as a row
            // of faces. Everything else is inside the team's popup.
            const inner = (
              <>
                <a href={`/teams?team=${t.id}`} className="team-card-name" aria-haspopup="dialog"
                  onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); open(t.id); }}>
                  {t.name}
                </a>
                {t.description ? <p className="team-card-desc">{t.description}</p> : null}
                <div className="team-card-avatars" aria-label={`${t.members.length} ${t.members.length === 1 ? "person" : "people"}`}>
                  {t.members.slice(0, 6).map((m, n) => (
                    <span key={m.id} title={`${m.display_name}${m.is_lead ? " (lead)" : ""}`} style={{ zIndex: 10 - n }}>
                      <Avatar avatar={m.avatar} seed={m.id} size={40} />
                    </span>
                  ))}
                  {t.members.length > 6 ? <span className="more">+{t.members.length - 6}</span> : null}
                  {t.members.length === 0 ? <span className="muted small-text">Nobody yet</span> : null}
                </div>
              </>
            );
            return (
              <li key={t.id} style={{ "--i": i } as React.CSSProperties}>
                {/* While the team is open, the popup hides this card and grows out of it. */}
                <div className="team-card" data-grow={`team-${t.id}`} inert={t.id === openId}>
                  <div className="team-card-inner" data-grow-content>{inner}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Popup open={team !== null} growFrom={`team-${team?.id ?? lastOpen.current}`} labelledBy={titleId} onClose={close} afterClose={backToCard} stack>
        {team ? <Detail team={team} people={people} canManage={canManage} canView={canView} error={error} titleId={titleId} onClose={close} /> : null}
      </Popup>
    </>
  );
}
