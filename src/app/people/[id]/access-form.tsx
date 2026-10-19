"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AppIcon } from "@/components/app-icon";

type Role = { key: string; name: string; actions: string[] };
type Action = { key: string; description: string; on: boolean };
type Notice = { tone: "ok" | "error"; text: string };

const CUSTOM = "__custom";

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((k) => b.has(k));
}

function AllowedIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.9 10.3l2.1 2.1 4.1-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlockedIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 5l10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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
export function SaveNotice({ tone, text, autoFocus = true }: Notice & { autoFocus?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return <p ref={ref} tabIndex={-1} className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>{text}</p>;
}

// A submit button that cannot be pressed twice: while its form is saving it is disabled and says so.
export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>;
}

function SaveBar({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="savebar">
      <button type="button" className="secondary small" onClick={onCancel} disabled={pending}>Cancel</button>
      <SubmitButton className="small" pendingText="Saving…">Save</SubmitButton>
    </div>
  );
}

// One app of a person's access list. The header holds the ready role; each action is one row, allowed or
// blocked. Choosing a role sets every row to what the role gives; changing a row makes it "custom".
// Save stores the role and only the rows that differ from it (single changes for this person).
export function AppPanel({ save, personId, appKey, appName, isPrototype, hue, icon, version, roles, actions, currentRole, locked,
  lockedNote, keptOut, leftover, initiallyOpen, notice }: {
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
  currentRole: string;
  locked: boolean;
  lockedNote: string | null;
  keptOut: string | null;          // "Never for Outsource" when the person's kind may never use this app
  leftover: boolean;               // kept out, but old access is still stored
  initiallyOpen: boolean;
  notice: Notice | null;
}) {
  const bodyId = useId();
  const roleSelect = useRef<HTMLSelectElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  // The save notice takes the focus once, when the page comes back from the save; not again on re-opening.
  const announced = useRef(false);
  useEffect(() => { announced.current = true; }, []);
  const initial = new Set(actions.filter((a) => a.on).map((a) => a.key));
  const [open, setOpen] = useState(initiallyOpen);
  const [role, setRole] = useState(currentRole);
  const [allowed, setAllowed] = useState(initial);
  const roleActions = new Set(roles.find((r) => r.key === role)?.actions ?? []);
  const custom = !sameSet(allowed, roleActions);
  const changed = role !== currentRole || !sameSet(allowed, initial);
  const expandable = !keptOut ? actions.length > 0 : leftover;

  function chooseRole(key: string) {
    if (key === CUSTOM) return;
    setRole(key);
    setAllowed(new Set(roles.find((r) => r.key === key)?.actions ?? []));
    setOpen(true);
  }

  function set(key: string, on: boolean) {
    setAllowed((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // Cancel removes the Save bar, so the focus goes to the role menu (or the app's name) instead of nowhere.
  function reset() {
    setRole(currentRole);
    setAllowed(initial);
    (roleSelect.current ?? toggle.current)?.focus();
  }

  const roleName = roles.find((r) => r.key === role)?.name;
  return (
    <form action={save} className={open ? "app-panel open" : "app-panel"} id={`app-${appKey}`}>
      <input type="hidden" name="person_id" value={personId} />
      <input type="hidden" name="app" value={appKey} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="role" value={keptOut ? "" : role} />
      <input type="hidden" name="ticks_for_role" value={keptOut ? "" : role} />
      {keptOut ? null : [...allowed].map((k) => <input key={k} type="hidden" name="action" value={k} />)}

      <div className="app-head">
        {expandable ? (
          <button ref={toggle} type="button" className="app-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
            <Chevron open={open} />
            <AppIcon appKey={appKey} icon={icon} hue={hue} size={28} />
            <span className="app-name">{appName}</span>
            {!keptOut ? <span className="count">{allowed.size}/{actions.length}</span> : null}
          </button>
        ) : (
          <span className="app-toggle static">
            <span className="chevron-space" />
            <AppIcon appKey={appKey} icon={icon} hue={hue} size={28} />
            <span className="app-name">{appName}</span>
          </span>
        )}
        {isPrototype ? <span className="pill plain">Prototype</span> : null}
        {keptOut ? (
          <span className="head-note">{keptOut}</span>
        ) : actions.length === 0 ? (
          <span className="head-note">No actions yet</span>
        ) : (
          <select ref={roleSelect} aria-label={`${appName} role`} value={custom ? CUSTOM : role} disabled={locked} onChange={(e) => chooseRole(e.target.value)}>
            {custom ? <option value={CUSTOM} disabled>{roleName ? `${roleName} (custom)` : "Custom"}</option> : null}
            <option value="">No access</option>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
        )}
      </div>

      {open && (expandable || notice) ? (
        <div className="app-body" id={bodyId}>
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
                  const group = `${appKey}:${a.key}`;
                  return (
                    <li key={a.key}>
                      <span className="perm-name" id={`${bodyId}-${a.key}`}>{a.description || a.key}</span>
                      {locked ? (
                        <span className={on ? "perm-state allow" : "perm-state block"}>{on ? <AllowedIcon /> : <BlockedIcon />}{on ? "Allowed" : "Blocked"}</span>
                      ) : (
                      <span className="seg" role="radiogroup" aria-labelledby={`${bodyId}-${a.key}`} data-state={on ? "allowed" : "blocked"}>
                        <label title="Allowed" className={on ? "on allow" : undefined}>
                          <input type="radio" name={group} className="sr-only" checked={on} disabled={locked} onChange={() => set(a.key, true)} />
                          <AllowedIcon /><span className="sr-only">Allowed</span>
                        </label>
                        <label title="Blocked" className={!on ? "on block" : undefined}>
                          <input type="radio" name={group} className="sr-only" checked={!on} disabled={locked} onChange={() => set(a.key, false)} />
                          <BlockedIcon /><span className="sr-only">Blocked</span>
                        </label>
                      </span>
                      )}
                    </li>
                  );
                })}
              </ul>
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
