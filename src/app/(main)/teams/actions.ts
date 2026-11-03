"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireAction } from "@/lib/session";
import { addTeamApp, addToTeam, createTeam, deleteTeam, removeTeamApp, setTeamAction, takeOffTeam, updateTeam, type TeamResult } from "@/lib/teams";

// Every action checks "manage" again on the server; the change itself checks once more inside its transaction.

function backToTeam(teamId: string, notice: string): never {
  if (!isUuid(teamId)) redirect("/teams?notice=not-found");
  revalidatePath("/teams");
  // A team opens as a popup on the Teams page (Buk, 2026-11-03), so a save comes back to it there.
  redirect(`/teams?team=${teamId}&notice=${notice}`);
}
export async function createTeamAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const made = await createTeam(db(), me.person_id, { name: form.get("name"), description: form.get("description") });
  if (made.result !== "added") redirect(`/teams?notice=${made.result}`);
  revalidatePath("/teams");
  redirect(`/teams?team=${made.id}&notice=team-added`);
}

export async function updateTeamAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const teamId = String(form.get("team_id") ?? "");
  const result = await updateTeam(db(), me.person_id, teamId, { name: form.get("name"), description: form.get("description") });
  backToTeam(teamId, result === "saved" ? "details-saved" : result);
}

// Add or Remove in a team's "Add people" window (Buk, 2026-11-03). Called straight from the window, not
// from a form, so it answers with the result instead of moving the page; the card shows the change at once
// and the Teams page is refreshed for everyone else's view.
export async function setTeamMemberAction(teamId: string, personId: string, on: boolean): Promise<TeamResult> {
  const { me } = await requireAction(ACTIONS.manage);
  const result = on ? await addToTeam(db(), me.person_id, personId, teamId) : await takeOffTeam(db(), me.person_id, personId, teamId);
  revalidatePath("/teams");
  revalidatePath("/people");
  return result;
}

// The open app in a team's popup: one action at a time, on or off (Buk, 2026-11-03: no ready roles). Called
// straight from the switches, not from a form, so they answer with the result and the popup stays as it is.
export async function setTeamActionNow(teamId: string, appKey: string, actionKey: string, allowed: boolean): Promise<TeamResult> {
  const { me } = await requireAction(ACTIONS.manage);
  const result = await setTeamAction(db(), me.person_id, teamId, appKey, actionKey, allowed);
  revalidatePath("/teams");
  revalidatePath("/people");
  return result;
}

// "Add app" in the team's "…" menu (Buk, 2026-11-03): put an app on the team's list, or take it off.
export async function setTeamAppNow(teamId: string, appKey: string, on: boolean): Promise<TeamResult> {
  const { me } = await requireAction(ACTIONS.manage);
  const result = on ? await addTeamApp(db(), me.person_id, teamId, appKey) : await removeTeamApp(db(), me.person_id, teamId, appKey);
  revalidatePath("/teams");
  revalidatePath("/people");
  return result;
}

// The team's "…" menu: delete it, after the admin confirmed (Buk, 2026-11-03).
export async function deleteTeamAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const teamId = String(form.get("team_id") ?? "");
  const result = await deleteTeam(db(), me.person_id, teamId);
  revalidatePath("/teams");
  revalidatePath("/people");
  if (result !== "saved") backToTeam(teamId, result);
  redirect("/teams?notice=team-deleted");
}
