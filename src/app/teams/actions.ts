"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireAction } from "@/lib/session";
import { createTeam, setTeamActive, setTeamRole, updateTeam } from "@/lib/teams";

// Every action checks "manage" again on the server; the change itself checks once more inside its transaction.

function backToTeam(teamId: string, notice: string, anchor = ""): never {
  if (!isUuid(teamId)) redirect("/teams?notice=not-found");
  revalidatePath(`/teams/${teamId}`);
  revalidatePath("/teams");
  redirect(`/teams/${teamId}?notice=${notice}${anchor}`);
}

export async function createTeamAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const made = await createTeam(db(), me.person_id, { name: form.get("name"), description: form.get("description") });
  if (made.result !== "added") redirect(`/teams?notice=${made.result}`);
  revalidatePath("/teams");
  redirect(`/teams/${made.id}?notice=team-added`);
}

export async function updateTeamAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const teamId = String(form.get("team_id") ?? "");
  const result = await updateTeam(db(), me.person_id, teamId, { name: form.get("name"), description: form.get("description") });
  backToTeam(teamId, result === "saved" ? "details-saved" : result);
}

export async function setTeamActiveAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const teamId = String(form.get("team_id") ?? "");
  const on = form.get("active") === "1";
  const result = await setTeamActive(db(), me.person_id, teamId, on);
  backToTeam(teamId, result === "saved" ? (on ? "turned-on" : "turned-off") : result);
}

export async function setTeamRoleAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const teamId = String(form.get("team_id") ?? "");
  const app = String(form.get("app") ?? "");
  const role = String(form.get("role") ?? "");
  const result = await setTeamRole(db(), me.person_id, teamId, app, role === "" ? null : role);
  backToTeam(teamId, result === "saved" ? "default-saved" : result, `#app-${encodeURIComponent(app)}`);
}
