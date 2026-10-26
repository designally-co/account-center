"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIONS } from "@/lib/access";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireAction } from "@/lib/session";
import {
  addSubscriptionMember, createSubscription, removeSubscriptionMember, setSubscriptionActive, updateSubscription,
} from "@/lib/subscriptions";

// Every action checks "manage" again on the server; the change itself checks once more inside its transaction.

function back(id: string, notice: string, anchor = ""): never {
  if (!isUuid(id)) redirect("/subscriptions?notice=not-found");
  revalidatePath(`/subscriptions/${id}`);
  revalidatePath("/subscriptions");
  redirect(`/subscriptions/${id}?notice=${notice}${anchor}`);
}

const fields = (form: FormData) => ({
  name: form.get("name"), shared_email: form.get("shared_email"), plan: form.get("plan"), url: form.get("url"), renews_on: form.get("renews_on"),
});

export async function createSubscriptionAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const made = await createSubscription(db(), me.person_id, fields(form));
  if (made.result !== "added") redirect(`/subscriptions?notice=${made.result}#new-subscription`);
  revalidatePath("/subscriptions");
  redirect(`/subscriptions/${made.id}?notice=added`);
}

export async function updateSubscriptionAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const id = String(form.get("subscription_id") ?? "");
  const result = await updateSubscription(db(), me.person_id, id, fields(form));
  back(id, result === "saved" ? "details-saved" : result, "#details-title");
}

export async function setSubscriptionActiveAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const id = String(form.get("subscription_id") ?? "");
  const on = form.get("active") === "1";
  const result = await setSubscriptionActive(db(), me.person_id, id, on);
  back(id, result === "saved" ? (on ? "turned-on" : "turned-off") : result);
}

export async function addMemberAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const id = String(form.get("subscription_id") ?? "");
  const result = await addSubscriptionMember(db(), me.person_id, id, String(form.get("person_id") ?? ""));
  back(id, result === "saved" ? "member-added" : result, "#members-title");
}

export async function removeMemberAction(form: FormData) {
  const { me } = await requireAction(ACTIONS.manage);
  const id = String(form.get("subscription_id") ?? "");
  const personId = String(form.get("person_id") ?? "");
  const result = await removeSubscriptionMember(db(), me.person_id, id, personId);
  if (isUuid(personId)) revalidatePath(`/people/${personId}`);
  back(id, result === "saved" ? "member-removed" : result, "#members-title");
}
