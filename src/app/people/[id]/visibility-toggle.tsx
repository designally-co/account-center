"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

// The app's visible / hidden button (Buk, 2026-10-26): a small tick or plus on a person's app card, or a full
// labelled button on the app's own page. It always asks first, in a dialog, and says what will change.
export function VisibilityToggle({ action, personId, personName, appKey, appName, version, on, roleName, locked, from, variant }: {
  action: (form: FormData) => Promise<void>;
  personId: string;
  personName: string;
  appKey: string;
  appName: string;
  version: string;
  on: boolean;
  roleName: string | null;     // what turning on gives
  locked: string | null;       // why it cannot be pressed, or null
  from: "person" | "app";
  variant: "icon" | "full";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = on ? `Hide ${appName} from ${personName}?` : `Make ${appName} visible to ${personName}?`;
  const label = on ? `Visible to ${personName}` : `Hidden from ${personName}`;
  const state = on ? "on" : "off";

  // An app without any actions yet has nothing to turn on: no mark at all, so nothing looks pressable.
  if (locked === "No actions yet") return null;
  if (locked) {
    return variant === "icon"
      ? <span className={`access-card-state ${state}`} title={locked} aria-label={`${label}. ${locked}`}><Mark on={on} /></span>
      : <span className={`visibility-button ${state} locked`} title={locked}><Mark on={on} />{label}<span className="muted small-text">· {locked}</span></span>;
  }
  return (
    <>
      <button type="button" className={variant === "icon" ? `access-card-state ${state}` : `visibility-button ${state}`}
        aria-label={variant === "icon" ? `${label}. ${on ? "Hide" : "Show"} ${appName}` : undefined}
        aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <Mark on={on} />{variant === "full" ? label : null}
      </button>
      <dialog ref={dialog} className="modal" aria-labelledby={`vis-title-${appKey}`}>
        <form action={action} className="stack">
          <input type="hidden" name="person_id" value={personId} />
          <input type="hidden" name="app" value={appKey} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <input type="hidden" name="from" value={from} />
          <h2 id={`vis-title-${appKey}`}>{title}</h2>
          <p className="muted">
            {on
              ? `${personName} loses every action in ${appName} at once, and it no longer shows on their Home. You can turn it on again later.`
              : `${personName} gets the ${roleName ?? "first"} role in ${appName}, and it shows on their Home. You can change the role on the app's page.`}
          </p>
          <div className="row modal-actions">
            <button type="button" className="secondary" onClick={() => dialog.current?.close()}>Cancel</button>
            <Confirm danger={on}>{on ? `Hide ${appName}` : `Make visible`}</Confirm>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Confirm({ children, danger }: { children: React.ReactNode; danger: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={danger ? "danger" : undefined} disabled={pending} autoFocus>{pending ? "Saving…" : children}</button>;
}

function Mark({ on }: { on: boolean }) {
  return on
    ? <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3.5v11M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
