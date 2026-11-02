"use client";

import { useFormStatus } from "react-dom";

// A form's submit button. While the form is saving it shows a small spinner and its pending words, and
// cannot be pressed twice.
export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={[className, pending ? "busy" : ""].filter(Boolean).join(" ") || undefined} disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
