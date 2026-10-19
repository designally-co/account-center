"use server";

import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { saveAppAccess, setKind } from "@/lib/access-lists";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireAction } from "@/lib/session";

// Every action checks "manage" again on the server (and the change itself checks "view" and "manage" once
// more, inside its transaction); hiding the controls is only for the screen.

function back(personId: string, notice: string, app?: string, jump = true): never {
  const id = isUuid(personId) ? personId : "";
  if (!id) redirect(`/people?notice=no-person`);
  const where = app ? `&app=${encodeURIComponent(app)}${jump ? `#app-${encodeURIComponent(app)}` : ""}` : "";
  redirect(`/people/${id}?notice=${notice}${where}`);
}

export async function setKindAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const { result, app } = await setKind(db(), me.person_id, personId, String(form.get("kind") ?? ""));
  // A refused kind change opens the app that blocks it, but stays at the top, where its message is.
  back(personId, result === "saved" ? "kind-saved" : result, app, false);
}

// One app of the access list: the ready role and the ticked actions, saved together.
// The page's script resets the ticks to a newly chosen role and says so in `ticks_for_role`. Without the
// script (or before it loads), the ticks still belong to the old role, so only the role is saved.
export async function saveAppAccessAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const app = String(form.get("app") ?? "");
  const role = String(form.get("role") ?? "");
  const ticksMatchRole = String(form.get("ticks_for_role") ?? "") === role;
  const ticked = ticksMatchRole ? form.getAll("action").map(String) : null;
  const result = await saveAppAccess(db(), me.person_id, personId, app, role === "" ? null : role, ticked, String(form.get("version") ?? ""));
  back(personId, result !== "saved" ? result : ticksMatchRole ? "saved" : "role-only", app);
}
