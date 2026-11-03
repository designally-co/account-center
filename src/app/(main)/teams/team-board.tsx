"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
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
export function TeamBoard({ teams, details, people, canManage, error }: {
  teams: TeamSummary[];
  details: Record<string, TeamDetail>;
  people: PickPerson[];
  canManage: boolean;
  error: string | null;    // an error from the last save, about the team that is open
}) {
  const search = useSearchParams();
  const asked = search.get("team");
  const openId = asked && details[asked] ? asked : null;
  const team = openId ? details[openId] : null;
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const lastOpen = useRef<string | null>(null);
  // The card the popup is shrinking back into: its words wait until it has landed.
  const [returning, setReturning] = useState<string | null>(null);

  const open = (id: string) => {
    window.history.pushState(null, "", `/teams?team=${id}`);
  };
  const close = () => {
    if (openId) setReturning(openId);
    window.history.replaceState(null, "", "/teams");
  };

  // While a team is open: the page behind does not scroll, Escape closes it (unless a list or a confirmation
  // inside it is open, which Escape closes first), Tab stays inside, and focus goes back to the card after.
  useEffect(() => {
    if (!openId) return;
    lastOpen.current = openId;
    const body = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = window.setTimeout(() => panel.current?.querySelector<HTMLElement>(".team-modal-close")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (document.querySelector("dialog[open]") || panel.current?.querySelector('.pik-pill[aria-expanded="true"]')) return;
        e.preventDefault();
        close();
      }
      if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const [a, z] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = body;
      window.clearTimeout(first);
      document.removeEventListener("keydown", onKey);
      // The card came back as a new element, so it is found again by its link.
      const id = lastOpen.current;
      window.setTimeout(() => document.querySelector<HTMLElement>(`.team-cards a.team-card-name[href="/teams?team=${id}"]`)?.focus(), 40);
    };
    // close() only reads openId, which is in the list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // How the card and the popup move: one spring for the box, so it grows out of the card and lands softly.
  const grow = { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.9 };

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
                  {t.is_active ? null : <span className="pill muted">Turned off</span>}
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
                <p className="small-text">
                  {t.defaults.length
                    ? t.defaults.map((d) => `${d.app_name}: ${d.role_name}`).join(" · ")
                    : <span className="muted">No default access yet</span>}
                </p>
              </>
            );
            return (
              <li key={t.id} style={{ "--i": i } as React.CSSProperties}>
                {isOpen ? (
                  /* While the team is open its card is the popup; this keeps its place in the grid. */
                  <div className="team-card placeholder" aria-hidden="true" inert>{inner}</div>
                ) : (
                  <motion.div layoutId={`team-${t.id}`} transition={grow} className={`team-card${t.is_active ? "" : " faded"}`}
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

      <AnimatePresence initial={false}>
        {team ? (
          <div className="team-modal-layer" key="team-modal">
            <motion.div className="team-modal-backdrop" onClick={close}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            <motion.div ref={panel} layoutId={`team-${team.id}`} transition={grow} className="team-modal"
              role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ borderRadius: 16 }}>
              {/* The words arrive once the box has grown, so they are never seen stretched. */}
              <motion.div className="team-modal-body"
                initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.14 } }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}>
                <button type="button" className="icon-button team-modal-close" aria-label="Close" onClick={close}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                </button>
                <Detail team={team} people={people} canManage={canManage} error={error} titleId={titleId} />
              </motion.div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
