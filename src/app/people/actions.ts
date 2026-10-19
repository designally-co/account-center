"use server";

import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { addWorkEmail, removePerson, removeWorkEmail } from "@/lib/people";
import { requireAction } from "@/lib/session";

// Every action checks "manage" again on the server; hiding the buttons is only for the screen.

// Work emails are added and removed on the person's page, so the answer goes back there.
function backToPerson(personId: string, notice: string): never {
  redirect(isUuid(personId) ? `/people/${personId}?notice=${notice}` : `/people?notice=no-person`);
}

export async function addWorkEmailAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const result = await addWorkEmail(db(), me.person_id, personId, form.get("email"));
  backToPerson(personId, result === "added" ? "email-added" : result);
}

export async function removeWorkEmailAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const result = await removeWorkEmail(db(), me.person_id, personId, String(form.get("email") ?? ""));
  backToPerson(personId, result === "removed" ? "email-removed" : result === "not-found" ? "email-not-found" : result);
}

export async function removePersonAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const result = await removePerson(db(), me.person_id, String(form.get("person_id") ?? ""));
  redirect(`/people?notice=${result === "removed" ? "person-removed" : `remove-${result}`}`);
}
