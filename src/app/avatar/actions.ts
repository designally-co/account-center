"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AVATAR_LATER_COOKIE, saveMyAvatar } from "@/lib/self";
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
  redirect(result === "saved" ? "/?notice=avatar-saved" : `/avatar?notice=${result}`);
}

// "Later" on the first-sign-in step: this browser skips the step from now on. Home still offers it.
export async function avatarLaterAction() {
  const store = await cookies();
  store.set(AVATAR_LATER_COOKIE, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}
