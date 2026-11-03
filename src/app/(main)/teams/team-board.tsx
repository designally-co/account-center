"use client";

import { useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import { GROW, Popup } from "@/components/popup";
import { Avatar } from "@/components/avatar";
import type { TeamDetail, TeamSummary } from "@/lib/teams";
import { TeamDetail as Detail } from "./team-detail";
import type { PickPerson } from "./team-members";

// The Teams page's cards, and each team as a popup over them (Buk, 2026-11-03: "each team page must be popup
// modal, not a page. and when user click the team in the teams page, show the small team card going bigger
// into a big popup modal"). The card and the popup share one framer-motion layoutId, so pressing a card grows
// that card into the popup, and closing shrinks it back into its place.
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
  // The card the popup is shrinking back into: its words wait until it has landed.
  const [returning, setReturning] = useState<string | null>(null);

  const open = (id: string) => {
    window.history.pushState(null, "", `/teams?team=${id}`);
  };
  const close = () => {
    if (openId) setReturning(openId);
    window.history.replaceState(null, "", "/teams");
  };
  // The card came back as a new element, so it is found again by its link.
  const backToCard = () => document.querySelector<HTMLElement>(`.team-cards a.team-card-name[href="/teams?team=${lastOpen.current}"]`)?.focus();

  const grow = GROW;

  return (
    <MotionConfig reducedMotion="user">
      {teams.length === 0 ? <p className="empty">No teams yet.</p> : (
        <ul className="team-cards" aria-label="Teams">
          {teams.map((t, i) => {
            const isOpen = t.id === openId;
            const inner = (
              <>
                <div className="team-card-head">
                  <a href={`/teams?team=${t.id}`} className="team-card-name" aria-haspopup="dialog"
                    onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); open(t.id); }}>
                    {t.name}
                  </a>
                </div>
                {t.description ? <p className="muted small-text">{t.description}</p> : null}
                <div className="team-card-avatars" aria-label={`${t.members.length} ${t.members.length === 1 ? "member" : "members"}`}>
                  {t.members.slice(0, 8).map((m) => (
                    <span key={m.id} title={`${m.display_name}${m.is_lead ? " (lead)" : ""}`} className={m.is_lead ? "lead" : undefined}>
                      <Avatar avatar={m.avatar} seed={m.id} size={32} />
                    </span>
                  ))}
                  {t.members.length > 8 ? <span className="more">+{t.members.length - 8}</span> : null}
                  {t.members.length === 0 ? <span className="muted small-text">No active members</span> : null}
                </div>
                {canManage ? (
                  <p className="small-text">
                    {t.defaults.length
                      ? t.defaults.map((d) => `${d.app_name}: ${d.role_name}`).join(" · ")
                      : <span className="muted">No default access yet</span>}
                  </p>
                ) : null}
              </>
            );
            return (
              <li key={t.id} style={{ "--i": i } as React.CSSProperties}>
                {isOpen ? (
                  /* While the team is open its card is the popup; this keeps its place in the grid. */
                  <div className="team-card placeholder" aria-hidden="true" inert>{inner}</div>
                ) : (
                  <motion.div layoutId={`team-${t.id}`} transition={grow} className="team-card"
                    style={{ borderRadius: 16 }} onLayoutAnimationComplete={() => { if (returning === t.id) setReturning(null); }}>
                    <motion.div className="team-card-inner" initial={returning === t.id ? { opacity: 0 } : false}
                      animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.16 } }}>
                      {inner}
                    </motion.div>
                  </motion.div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Popup open={team !== null} layoutId={`team-${team?.id ?? lastOpen.current}`} labelledBy={titleId} onClose={close} afterClose={backToCard}>
        {team ? <Detail team={team} people={people} canManage={canManage} canView={canView} error={error} titleId={titleId} /> : null}
      </Popup>
    </MotionConfig>
  );
}
