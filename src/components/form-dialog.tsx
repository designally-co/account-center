"use client";

import { closeDialog } from "@/components/motion";
import { useEffect, useId, useRef } from "react";

// A button at the top of a list page that opens its "add" form in a dialog, so the list stays the page's
// focus (Buk, 2026-11-02). When the last try came back with an error, the dialog opens again by itself with
// the error inside.
export function FormDialog({ trigger, title, open = false, children }: { trigger: string; title: string; open?: boolean; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
  }, [open]);
  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2.5v9M2.5 7h9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        {trigger}
      </button>
      <dialog ref={dialog} className="modal wide" aria-labelledby={`${id}-title`}>
        <div className="stack">
          <div className="modal-head">
            <h2 id={`${id}-title`}>{title}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => closeDialog(dialog.current)}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}
