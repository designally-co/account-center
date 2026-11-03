"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireAction } from "@/lib/session";
import { addToTeam, createTeam, setTeamRole, takeOffTeam, updateTeam, type TeamResult } from "@/lib/teams";

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

export async function setTeamRoleAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const teamId = String(form.get("team_id") ?? "");
  const app = String(form.get("app") ?? "");
  const role = String(form.get("role") ?? "");
  const result = await setTeamRole(db(), me.person_id, teamId, app, role === "" ? null : role);
  backToTeam(teamId, result === "saved" ? "default-saved" : result);
}

// A tick or an untick in a team card's Assignees list (Buk, 2026-11-02). Called straight from the card, not
// from a form, so it answers with the result instead of moving the page; the card shows the change at once
// and the Teams page is refreshed for everyone else's view.
export async function setTeamMemberAction(teamId: string, personId: string, on: boolean): Promise<TeamResult> {
  const { me } = await requireAction(ACTIONS.manage);
  const result = on ? await addToTeam(db(), me.person_id, personId, teamId) : await takeOffTeam(db(), me.person_id, personId, teamId);
  revalidatePath("/teams");
  revalidatePath("/people");
  return result;
}
