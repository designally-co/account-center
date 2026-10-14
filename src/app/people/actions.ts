"use server";

import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { addWorkEmail, copyFromHr, removeWorkEmail } from "@/lib/people";
import { requireAction } from "@/lib/session";

// Every action checks "manage" again on the server; hiding the buttons is only for the screen.

export async function addWorkEmailAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const result = await addWorkEmail(db(), me.person_id, String(form.get("person_id") ?? ""), form.get("email"));
  redirect(`/people?notice=${result === "added" ? "email-added" : result}`);
}

export async function removeWorkEmailAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const removed = await removeWorkEmail(db(), me.person_id, String(form.get("person_id") ?? ""), String(form.get("email") ?? ""));
  redirect(`/people?notice=${removed ? "email-removed" : "email-not-found"}`);
}

export async function copyFromHrAction() {
  const { me } = await requireAction(ACTIONS.manage);
  const r = await copyFromHr(db(), me.person_id);
  redirect(`/people?notice=copied&added=${r.added}&updated=${r.updated}&linked=${r.linked}&inactive=${r.marked_inactive}`);
}
