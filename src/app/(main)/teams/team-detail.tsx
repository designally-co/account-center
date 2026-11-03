"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { Crown, Ellipsis, PencilLine, Trash2, UserPlus, X } from "lucide-react";
import { GROW } from "@/components/popup";
import { Avatar } from "@/components/avatar";
import { SubmitButton } from "@/components/submit-button";
import type { TeamDetail as Team } from "@/lib/teams";
import { deleteTeamAction, updateTeamAction } from "./actions";
import { TeamApps, LIQUID } from "./team-apps";
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
  const edit = useRef<HTMLDialogElement>(null);
  const add = useRef<HTMLDialogElement>(null);
  const remove = useRef<HTMLDialogElement>(null);
  const removeTitle = useId();
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const editTitle = useId();
  // A save comes back with the new name (or an error shown in the popup): the edit window closes then.
  useEffect(() => { edit.current?.close(); }, [team.name, team.description, error]);

  // Separate cards, no big box (Buk, 2026-11-03: "I want the view to be separated containers not inside one big
  // container"): the team's card on top, which is the Teams page's card grown bigger, then the apps' cards.
  // One layout group for all of them: when an app opens, the people, the team's card and the app cards move in
  // the same spring, so nothing jumps while something else slides.
  return (
    <LayoutGroup id={`sheet-${team.id}`}>
    <div className="team-stack">
      <motion.div layoutId={`team-${team.id}`} transition={GROW} className="stack-card team-head-card" style={{ borderRadius: 20 }}>
      {/* The words arrive once the card has grown, so they are never seen stretched. */}
      <motion.div className="stack team-sheet" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.2, delay: 0.14 } }}
        exit={{ opacity: 0, transition: { duration: 0.08 } }}>
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
                  <button type="button" className="secondary" onClick={() => remove.current?.close()}>Cancel</button>
                  <SubmitButton className="danger" pendingText="Deleting…">Delete team</SubmitButton>
                </div>
              </form>
            </dialog>
            <dialog ref={edit} className="modal wide" aria-labelledby={editTitle}>
              <div className="stack">
                <div className="modal-head">
                  <h2 id={editTitle}>Edit team info</h2>
                  <button type="button" className="icon-button" aria-label="Close" onClick={() => edit.current?.close()}>
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

      <motion.section layout="position" transition={LIQUID} className="team-people" aria-label={`People in ${team.name}`}>
        <p className="team-people-label">
          People <span>{team.members.length}</span>
        </p>
        {team.members.length === 0 ? <p className="muted small-text">Nobody in this team yet.{canManage ? " Add people from the … menu." : ""}</p> : (
          <motion.ul layout transition={LIQUID} className={`team-faces${compact ? " compact" : ""}`}>
              {team.members.map((m, i) => {
                const face = (
                  <>
                    <motion.span layout className="team-face-avatar" transition={LIQUID}>
                      <Avatar avatar={m.avatar} seed={m.id} size={compact ? 30 : 48} />
                    </motion.span>
                    {compact ? null : (
                      <motion.span className="team-face-text" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.12 } }}>
                        <strong>{m.display_name}</strong>
                        {canView && m.email ? <span className="team-face-email">{m.email}</span> : null}
                      </motion.span>
                    )}
                    {!compact && m.is_lead ? <span className="team-face-lead"><Crown size={10} strokeWidth={2.2} aria-hidden="true" />Lead</span> : null}
                  </>
                );
                return (
                  <motion.li key={m.id} layout transition={LIQUID} className="team-face" title={compact ? `${m.display_name}${m.is_lead ? " (lead)" : ""}` : undefined}
                    style={{ borderRadius: compact ? 999 : 14, zIndex: compact ? team.members.length - i : undefined }}>
                    {canView ? <Link href={`/people?person=${m.id}`} className="team-face-link">{face}</Link> : <span className="team-face-link">{face}</span>}
                  </motion.li>
                );
              })}
          </motion.ul>
        )}
      </motion.section>

      </motion.div>
      </motion.div>
      {canManage ? <TeamApps teamId={team.id} teamName={team.name} apps={team.defaults} open={openApp} onOpen={setOpenApp} /> : null}
    </div>
    </LayoutGroup>
  );
}
