"use client";

import { closeDialog } from "@/components/motion";
import { useId, useRef } from "react";
import { SubmitButton } from "./submit-button";

// A button that asks first, in the browser's own dialog (Escape closes it, focus stays inside), then sends
// the form. Used for every action that takes something away: removing a person, turning a team or a shared
// subscription off. The words say exactly what will happen.
export function ConfirmAction({ action, fields, trigger, triggerClass = "secondary danger-outline", title, body, confirm, pending = "Saving…" }: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  trigger: string;
  triggerClass?: string;
  title: string;
  body: string;
  confirm: string;
  pending?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button type="button" className={triggerClass} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>{trigger}</button>
      <dialog ref={dialog} className="modal" aria-labelledby={`${id}-title`} aria-describedby={`${id}-body`}>
        <form action={action} className="stack">
          {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
          <h2 id={`${id}-title`}>{title}</h2>
          <p id={`${id}-body`} className="muted">{body}</p>
          <div className="row modal-actions">
            <button type="button" className="secondary" onClick={() => closeDialog(dialog.current)}>Cancel</button>
            <SubmitButton className="danger" pendingText={pending}>{confirm}</SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
