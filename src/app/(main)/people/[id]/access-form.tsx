"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Toast } from "@/components/toast";
import { AppIcon } from "@/components/app-icon";
import { SubmitButton } from "@/components/submit-button";
import { Switch } from "@/components/switch";

type Role = { key: string; name: string; actions: string[] };
type Action = { key: string; description: string; on: boolean };
type Notice = { tone: "ok" | "error"; text: string };

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((k) => b.has(k));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className={open ? "chevron open" : "chevron"}>
      <path d="M7.5 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The result of a save, shown where the change was made. The first time it appears it takes the focus, so
// the screen scrolls to it and a screen reader reads it out.
// Success is a toast; an error stays here, next to what it is about, and takes the focus.
export function SaveNotice({ tone, text, autoFocus = true }: Notice & { autoFocus?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (autoFocus && tone === "error") ref.current?.focus(); }, [autoFocus, tone]);
  if (tone === "ok") return <Toast text={text} />;
  return <p ref={ref} tabIndex={-1} className={`notice ${tone}`} role="alert">{text}</p>;
}

// A submit button that cannot be pressed twice: while its form is saving it is disabled and says so.
export { SubmitButton };

function SaveBar({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="savebar">
      <button type="button" className="secondary small" onClick={onCancel} disabled={pending}>Cancel</button>
      <SubmitButton className="small" pendingText="Saving…">Save</SubmitButton>
    </div>
  );
}

// One app of a person's access list: each action is one row with a plain on/off switch (Buk, 2026-11-03: "remove
// ready role across the site just keep manualy single access control and make the toggle simple just on and off").
// Nothing shows a ready role. Underneath, what the person had before (their own role, or what their teams give)
// stays where it is, and Save stores only the rows that differ from it, as single changes for this person.
// Account Center itself keeps its two levels: "Manage" makes someone an admin (every action in every app), and
// needs "View"; its switches pick the level.
export function AppPanel({ save, personId, appKey, appName, isPrototype, hue, icon, version, roles, actions, currentRole, locked,
  lockedNote, keptOut, leftover, initiallyOpen, notice, fixedNote = null, standalone = false }: {
  save: (form: FormData) => Promise<void>;
  personId: string;
  appKey: string;
  appName: string;
  isPrototype: boolean;
  hue: number | null;
  icon: string | null;
  version: string;
  roles: Role[];
  actions: Action[];
  currentRole: string;             // where the person's access starts; kept as it is
  locked: boolean;
  lockedNote: string | null;
  keptOut: string | null;          // "Never for Outsource" when the person's kind may never use this app
  leftover: boolean;               // kept out, but old access is still stored
  initiallyOpen: boolean;
  notice: Notice | null;
  fixedNote?: string | null;       // shown instead of the count (an admin has every action)
  standalone?: boolean;            // on the app's own page: always open, titled "Permissions"
}) {
  const bodyId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLDivElement>(null);
  // The save notice takes the focus once, when the page comes back from the save; not again on re-opening.
  const announced = useRef(false);
  useEffect(() => { announced.current = true; }, []);
  const initial = new Set(actions.filter((a) => a.on).map((a) => a.key));
  const [openState, setOpen] = useState(initiallyOpen || standalone);
  const open = standalone || openState;
  const [allowed, setAllowed] = useState(initial);
  const changed = !sameSet(allowed, initial);
  const expandable = !keptOut ? actions.length > 0 : leftover;
  const isAccountCenter = appKey === "account_center";

  // Account Center's level from its switches: the smallest of its levels that holds every switch that is on.
  const level = isAccountCenter
    ? [...roles].sort((a, b) => a.actions.length - b.actions.length).find((r) => [...allowed].every((k) => r.actions.includes(k)))?.key ?? ""
    : currentRole;

  function set(key: string, on: boolean) {
    setAllowed((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      // Managing Account Center needs seeing it: the two switches follow each other.
      if (isAccountCenter && on && key === "account_center.manage") next.add("account_center.view");
      if (isAccountCenter && !on && key === "account_center.view") next.delete("account_center.manage");
      return next;
    });
  }

  // Cancel removes the Save bar, so the focus goes back to the first switch (or the app's name).
  function reset() {
    setAllowed(initial);
    (first.current?.querySelector<HTMLElement>("button") ?? toggle.current)?.focus();
  }

  const count = !keptOut && actions.length > 0 ? <span key={allowed.size} className="count bump">{allowed.size} of {actions.length} on</span> : null;
  return (
    <form action={save} className={`app-panel${open ? " open" : ""}${standalone ? " standalone" : ""}`} id={`app-${appKey}`}>
      <input type="hidden" name="person_id" value={personId} />
      <input type="hidden" name="app" value={appKey} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="role" value={keptOut ? "" : level} />
      <input type="hidden" name="ticks_for_role" value={keptOut ? "" : level} />
      {keptOut ? null : [...allowed].map((k) => <input key={k} type="hidden" name="action" value={k} />)}

      <div className="app-head">
        {standalone ? (
          <span className="app-toggle static">
            <span className="app-name">Permissions</span>
          </span>
        ) : expandable ? (
          <button ref={toggle} type="button" className="app-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
            <Chevron open={open} />
            <AppIcon appKey={appKey} name={appName} icon={icon} hue={hue} size={28} />
            <span className="app-name">{appName}</span>
          </button>
        ) : (
          <span className="app-toggle static">
            <span className="chevron-space" />
            <AppIcon appKey={appKey} name={appName} icon={icon} hue={hue} size={28} />
            <span className="app-name">{appName}</span>
          </span>
        )}
        {isPrototype && !standalone ? <span className="pill plain">Prototype</span> : null}
        {keptOut ? (
          <span className="head-note">{keptOut}</span>
        ) : fixedNote && actions.length > 0 ? (
          <span className="pill ok">{fixedNote}</span>
        ) : actions.length === 0 ? (
          <span className="head-note">No actions yet</span>
        ) : count}
      </div>

      {open && (expandable || notice) ? (
        <div className="app-body" id={bodyId} ref={first}>
          {notice ? <SaveNotice {...notice} autoFocus={!announced.current} /> : null}
          {!expandable ? null : keptOut ? (
            <div className="row">
              <span className="muted">Old access is still stored here.</span>
              {!locked ? <SubmitButton className="secondary small" pendingText="Removing…">Remove</SubmitButton> : null}
            </div>
          ) : (
            <>
              <ul className="perm-list">
                {actions.map((a) => {
                  const on = allowed.has(a.key);
                  return (
                    <li key={a.key}>
                      <span className="perm-name" id={`${bodyId}-${a.key}`}>{a.description || a.key}</span>
                      {locked ? (
                        <span className={on ? "perm-state allow" : "perm-state block"}>{on ? "On" : "Off"}</span>
                      ) : (
                        <Switch on={on} label={a.description || a.key} onChange={(v) => set(a.key, v)} />
                      )}
                    </li>
                  );
                })}
              </ul>
              {isAccountCenter && !locked ? <p className="muted small-text">Manage makes them an admin: every action in every app.</p> : null}
              {lockedNote ? <p className="muted small-text">{lockedNote}</p> : null}
              {changed && !locked ? (
                <SaveBar onCancel={reset} />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </form>
  );
}
