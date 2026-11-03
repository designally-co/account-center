"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Crown, Ellipsis, PencilLine, Trash2, UserPlus, X } from "lucide-react";
import { Flip, IN_OUT, closeDialog, gsap, reducedMotion } from "@/components/motion";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import type { TeamDetail as Team } from "@/lib/teams";
import { deleteTeamAction, updateTeamAction } from "./actions";
import { TeamApps } from "./team-apps";
import { TeamPeopleDialog, type PickPerson } from "./team-people";

// What a team's popup holds (Buk, 2026-11-03, from his layout: the team's name and description with a "…" menu,
// its people as tiles, and its apps as an accordion). Opening an app shrinks the people into a row of faces, so
// the app's switches have the room; closing it brings the tiles back. Every company person sees the team and its
// people; only an admin sees the apps (the team's default access) and the "…" menu: Edit info, Add people and
// Delete team (Buk, 2026-11-03).
// A team is never turned off (Buk, 2026-11-03).
export function TeamDetail({ team, people, canManage, canView, error, titleId, onClose }: {
  team: Team; people: PickPerson[]; canManage: boolean; canView: boolean; error: string | null; titleId: string; onClose: () => void;
}) {
  const [openApp, setOpenApp] = useState<string | null>(null);
  const compact = openApp !== null;
  // Opening or closing an app moves almost everything: the app cards split or join, the people's tiles become a
  // row of faces or tiles again, and the column re-centres. GSAP's Flip notes where every marked part
  // (data-flip-id) is just before the change and slides each one from there to its new place, all in one ease.
  const stackRef = useRef<HTMLDivElement>(null);
  const before = useRef<Flip.FlipState | null>(null);
  const toggleApp = (key: string | null) => {
    if (stackRef.current && !reducedMotion()) before.current = Flip.getState(stackRef.current.querySelectorAll("[data-flip-id]"));
    setOpenApp(key);
  };
  useLayoutEffect(() => {
    const state = before.current;
    before.current = null;
    if (!state || !stackRef.current) return;
    Flip.from(state, {
      targets: stackRef.current.querySelectorAll("[data-flip-id]"),
      duration: 0.6, ease: IN_OUT, nested: true, prune: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.35, delay: 0.2, ease: "power1.out" }),
    });
  }, [openApp]);
  const edit = useRef<HTMLDialogElement>(null);
  const add = useRef<HTMLDialogElement>(null);
  const remove = useRef<HTMLDialogElement>(null);
  const removeTitle = useId();
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const editTitle = useId();
  // A save comes back with the new name (or an error shown in the popup): the edit window closes then.
  useEffect(() => { closeDialog(edit.current); }, [team.name, team.description, error]);

  // Separate cards, no big box (Buk, 2026-11-03: "I want the view to be separated containers not inside one big
  // container"): the team's card on top, which is the Teams page's card grown bigger (data-grow-target), then
  // the apps' cards (data-grow-follow).
  return (
    <div className="team-stack" ref={stackRef}>
      <div className="stack-card team-head-card" data-grow-target data-flip-id="head">
      {/* The words arrive once the card has grown, so they are never seen stretched. */}
      <div className="stack team-sheet" data-grow-content>
      <header className="team-sheet-head">
        <h2 id={titleId} className="team-sheet-title">{team.name}</h2>
        {team.description ? <p className="team-sheet-desc">{team.description}</p> : null}
        {canManage ? (
          <>
            <button type="button" className="icon-button team-sheet-more" aria-label={`More for ${team.name}`} popoverTarget={menuId}
              onClick={(e) => {
                // The menu opens under the button, its right edge on the button's.
                const r = e.currentTarget.getBoundingClientRect();
                if (menu.current) Object.assign(menu.current.style, { top: `${Math.round(r.bottom + 6)}px`, left: `${Math.round(Math.max(8, r.right - 240))}px` });
              }}>
              <Ellipsis size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div id={menuId} popover="auto" className="menu team-sheet-menu" ref={menu}>
              <button type="button" className="menu-item" onClick={() => { menu.current?.hidePopover?.(); edit.current?.showModal(); }}>
                <PencilLine size={16} strokeWidth={1.6} aria-hidden="true" />
                Edit info
              </button>
              <button type="button" className="menu-item" onClick={() => { menu.current?.hidePopover?.(); add.current?.showModal(); }}>
                <UserPlus size={16} strokeWidth={1.6} aria-hidden="true" />
                Add people
              </button>
              <button type="button" className="menu-item menu-danger" onClick={() => { menu.current?.hidePopover?.(); remove.current?.showModal(); }}>
                <Trash2 size={16} strokeWidth={1.6} aria-hidden="true" />
                Delete team
              </button>
            </div>
            <TeamPeopleDialog ref={add} teamId={team.id} teamName={team.name} people={people}
              members={team.members.map((m) => m.id)} leads={team.members.filter((m) => m.is_lead).map((m) => m.id)} />
            <dialog ref={remove} className="modal" aria-labelledby={removeTitle}>
              <form action={deleteTeamAction} className="stack">
                <input type="hidden" name="team_id" value={team.id} />
                <h2 id={removeTitle}>Delete {team.name}?</h2>
                <p className="muted">
                  {team.members.length
                    ? `Its ${team.members.length} ${team.members.length === 1 ? "person loses" : "people lose"} this team's default access. Anyone for whom it is the primary team gets their next team as primary. Access set for each person stays.`
                    : "Nobody is in it."} This cannot be undone.
                </p>
                <div className="row modal-actions">
                  <button type="button" className="secondary" onClick={() => closeDialog(remove.current)}>Cancel</button>
                  <SubmitButton className="danger" pendingText="Deleting…">Delete team</SubmitButton>
                </div>
              </form>
            </dialog>
            <dialog ref={edit} className="modal wide" aria-labelledby={editTitle}>
              <div className="stack">
                <div className="modal-head">
                  <h2 id={editTitle}>Edit team info</h2>
                  <button type="button" className="icon-button" aria-label="Close" onClick={() => closeDialog(edit.current)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                  </button>
                </div>
                <form action={updateTeamAction} className="stack">
                  <input type="hidden" name="team_id" value={team.id} />
                  <label className="field">Name <input name="name" required maxLength={60} defaultValue={team.name} /></label>
                  <label className="field">Short description (optional) <input name="description" maxLength={160} defaultValue={team.description} /></label>
                  <div className="row modal-actions"><SubmitButton pendingText="Saving…">Save</SubmitButton></div>
                </form>
              </div>
            </dialog>
          </>
        ) : null}
        <button type="button" className="icon-button popup-close team-sheet-close" aria-label="Close" onClick={onClose}>
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      {error ? <p className="notice error" role="alert">{error}</p> : null}

      <section className="team-people" aria-label={`People in ${team.name}`}>
        <p className="team-people-label">
          People <span>{team.members.length}</span>
        </p>
        {team.members.length === 0 ? <p className="muted small-text">Nobody in this team yet.{canManage ? " Add people from the … menu." : ""}</p> : (
          <ul className={`team-faces${compact ? " compact" : ""}`}>
              {team.members.map((m, i) => {
                const face = (
                  <>
                    <span className="team-face-avatar" data-flip-id={`face-${m.id}`}>
                      <Avatar avatar={m.avatar} seed={m.id} size={48} />
                    </span>
                    {compact ? null : (
                      <span className="team-face-text" data-flip-id={`words-${m.id}`}>
                        <strong>{m.display_name}</strong>
                        {canView && m.email ? <span className="team-face-email">{m.email}</span> : null}
                      </span>
                    )}
                    {!compact && m.is_lead ? <span className="team-face-lead" data-flip-id={`lead-${m.id}`}><Crown size={10} strokeWidth={2.2} aria-hidden="true" />Lead</span> : null}
                  </>
                );
                return (
                  <li key={m.id} className="team-face" data-flip-id={`tile-${m.id}`} title={compact ? `${m.display_name}${m.is_lead ? " (lead)" : ""}` : undefined}
                    style={{ zIndex: compact ? team.members.length - i : undefined }}>
                    {canView ? <Link href={`/people?person=${m.id}`} className="team-face-link">{face}</Link> : <span className="team-face-link">{face}</span>}
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      </div>
      </div>
      {canManage ? <TeamApps teamId={team.id} teamName={team.name} apps={team.defaults} open={openApp} onOpen={toggleApp} /> : null}
    </div>
  );
}
