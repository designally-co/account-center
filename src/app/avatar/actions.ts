"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { saveMyAvatar } from "@/lib/self";
import { currentUserId } from "@/lib/session";

// A person saves their own avatar. Nobody can save someone else's: the server takes the person from the
// signed-in account, never from the form.
export async function saveMyAvatarAction(form: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  let raw: unknown = null;
  try { raw = JSON.parse(String(form.get("avatar") ?? "")); } catch { raw = null; }
  const result = await saveMyAvatar(db(), userId, raw);
  if (result === "no-person") redirect("/no-access");
  redirect(result === "saved" ? "/?notice=avatar-saved" : "/avatar?notice=invalid");
}
