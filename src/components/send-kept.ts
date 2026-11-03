import { startTransition } from "react";

// React resets a form's fields once a <form action={...}> has finished. A form whose fields follow React state
// (a select or a tick that shows Save only after a change) would then show one value and send another the next
// time: after saving a primary team, the box showed "No team" (found 2026-11-03). Such forms send themselves
// with this instead, so nothing is reset; pass useActionState's isPending to their SubmitButton.
export function sendKept(dispatch: (data: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
}
