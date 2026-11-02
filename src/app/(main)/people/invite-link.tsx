"use client";

import { useState } from "react";

// An invitation link the admin passes on by hand, when the email could not be sent. It works once.
export function InviteLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="invite-link">
      <label className="sr-only" htmlFor="invite-link">Invitation link</label>
      <input id="invite-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="secondary small" onClick={async () => {
        try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
      }}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  );
}
