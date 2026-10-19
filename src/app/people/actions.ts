"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { addWorkEmail, removePerson, removeWorkEmail } from "@/lib/people";
import { requireAction } from "@/lib/session";

// Every action checks "manage" again on the server; hiding the buttons is only for the screen.

// Work emails are added and removed on the person's page. The answer comes back to that form, and the page
// refreshes in place, so unsaved changes elsewhere on the page stay.
export type FormNotice = { notice?: string; n?: number };

// One action for both, so the newest answer is the one shown. `op` is "add" or "remove".
export async function workEmailAction(prev: FormNotice, form: FormData): Promise<FormNotice> {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  let notice: string;
  if (form.get("op") === "remove") {
    const result = await removeWorkEmail(db(), me.person_id, personId, String(form.get("email") ?? ""));
    notice = result === "removed" ? "email-removed" : result === "not-found" ? "email-not-found" : result;
  } else {
    const result = await addWorkEmail(db(), me.person_id, personId, form.get("email"));
    notice = result === "added" ? "email-added" : result;
  }
  if (isUuid(personId)) revalidatePath(`/people/${personId}`);
  return { notice, n: (prev.n ?? 0) + 1 };
}

export async function removePersonAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const result = await removePerson(db(), me.person_id, String(form.get("person_id") ?? ""));
  redirect(`/people?notice=${result === "removed" ? "person-removed" : `remove-${result}`}`);
}
