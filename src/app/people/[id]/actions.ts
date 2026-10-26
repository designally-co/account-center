"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { saveAppAccess, setKind } from "@/lib/access-lists";
import { setPersonTeam } from "@/lib/teams";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireAction } from "@/lib/session";

// Every action checks "manage" again on the server (and the change itself checks "view" and "manage" once
// more, inside its transaction); hiding the controls is only for the screen.

// After saving one app, back to that app's own page (or the person's page when the app key is not a plain key).
function back(personId: string, notice: string, app: string): never {
  const id = isUuid(personId) ? personId : "";
  if (!id) redirect(`/people?notice=no-person`);
  revalidatePath(`/people/${id}`);
  if (!/^[a-z][a-z0-9_]*$/.test(app)) redirect(`/people/${id}?notice=${notice}`);
  redirect(`/people/${id}/apps/${app}?notice=${notice}`);
}

// The answer comes back to the Kind form, and the page refreshes in place, so unsaved changes in the app
// panels stay. A refusal names the app that blocks the change.
export type KindNotice = { notice?: string; app?: string; n?: number };

export async function setKindAction(prev: KindNotice, form: FormData): Promise<KindNotice> {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const { result, app } = await setKind(db(), me.person_id, personId, String(form.get("kind") ?? ""));
  if (isUuid(personId)) revalidatePath(`/people/${personId}`);
  return { notice: result === "saved" ? "kind-saved" : result === "yourself" ? "kind-yourself" : result, app, n: (prev.n ?? 0) + 1 };
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

// The person's team and whether they lead it. The answer comes back to the Team form; the page refreshes in
// place, so the app panels below show the new team's default access at once.
export type TeamNotice = { notice?: string; n?: number };

export async function setTeamAction(prev: TeamNotice, form: FormData): Promise<TeamNotice> {
  const { me } = await requireAction(ACTIONS.manage);
  const personId = String(form.get("person_id") ?? "");
  const team = String(form.get("team") ?? "");
  const result = await setPersonTeam(db(), me.person_id, personId, team === "" ? null : team, team !== "" && form.get("is_lead") === "on");
  if (isUuid(personId)) revalidatePath(`/people/${personId}`);
  return { notice: result === "saved" ? "team-saved" : result, n: (prev.n ?? 0) + 1 };
}
