"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { sendInvite } from "@/lib/invites";
import { addPerson, addWorkEmail, removePerson, removeWorkEmail } from "@/lib/people";
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
  const view = form.get("view") === "list" ? "list" : "grid";
  redirect(`/people?view=${view}&notice=${result === "removed" ? "person-removed" : `remove-${result}`}`);
}

// Add a new company person and give them a login (Buk, 2026-10-19). The person is saved first, then the
// account-invite server function makes their login and emails the invitation. When the email cannot be
// sent, the admin gets the link here, to pass on by hand.
export type AddState = { error?: string; existingId?: string; personId?: string; name?: string; mail?: string; link?: string };

export async function addPersonAction(_: AddState, form: FormData): Promise<AddState> {
  const { me } = await requireAction(ACTIONS.manage);
  const added = await addPerson(db(), me.person_id, { name: form.get("name"), email: form.get("email"), kind: form.get("kind") });
  if (added.result === "taken" || added.result === "removed") return { error: added.result, existingId: added.id };
  if (added.result !== "added") return { error: added.result };
  revalidatePath("/people");
  const sent = await sendInvite(added.id);
  if ("error" in sent) redirect(`/people/${added.id}?notice=invite-${sent.error}`);
  if (!("link" in sent)) redirect(`/people/${added.id}?notice=invite-${sent.result}`);
  return { personId: added.id, name: String(form.get("name") ?? "").trim(), mail: sent.result, link: sent.link };
}

// Send the invitation again (or for the first time, for someone with no login yet).
export type InviteState = { notice?: string; link?: string; n?: number };

export async function sendInviteAction(prev: InviteState, form: FormData): Promise<InviteState> {
  await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const n = (prev.n ?? 0) + 1;
  if (!isUuid(personId)) return { notice: "no-person", n };
  const sent = await sendInvite(personId, form.get("link_existing") === "1");
  revalidatePath(`/people/${personId}`);
  // Linking changes the person's sign-in state, so the row that sent it goes away: say it on the page.
  if (!("error" in sent) && sent.result === "linked") redirect(`/people/${personId}?notice=invite-linked`);
  if ("error" in sent) return { notice: sent.error, n };
  return "link" in sent ? { notice: sent.result, link: sent.link, n } : { notice: sent.result, n };
}
