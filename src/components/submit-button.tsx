"use client";

import { useFormStatus } from "react-dom";

// A form's submit button. While the form is saving it shows a small spinner and its pending words, and
// cannot be pressed twice. A form that sends itself (sendKept) passes `pending`.
export function SubmitButton({ children, pendingText, className, pending: busy }: {
  children: React.ReactNode; pendingText: string; className?: string; pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = busy ?? status.pending;
  return (
    <button type="submit" className={[className, pending ? "busy" : ""].filter(Boolean).join(" ") || undefined} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
